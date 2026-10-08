import {test,expect,launch,action,pause,resume,tap} from './helpers';
import type {Page} from '@playwright/test';

async function friendlyBuildingPoint(page:Page){
  // Landscape Orders occupies the screen center until the player minimizes it.
  // Preserve the armed order: Focus Commander would intentionally cancel it.
  if(!await page.locator('.command-deck').evaluate(el=>el.classList.contains('collapsed')))
    await action(page,'toggle-deck').click();
  await expect(page.locator('.command-deck')).toHaveClass(/collapsed/);
  const target=await page.evaluate(()=>{
    const s=window.__FRONTIER__.state,b=s.entities.find(e=>e.team===0&&e.type==='barracks')!;
    return {id:b.id,x:b.x,y:b.y,width:s.map.width,height:s.map.height};
  });
  const map=(await page.locator('#minimap').boundingBox())!;
  await tap(page,{x:map.x+map.width*target.x/target.width,y:map.y+map.height*target.y/target.height});
  await expect.poll(()=>page.evaluate(({x,y})=>Math.hypot(window.__FRONTIER__.renderer.camera.x-x,window.__FRONTIER__.renderer.camera.y-y),target)).toBeLessThan(.1);
  await expect.poll(()=>page.evaluate(({x,y})=>{
    const p=window.__FRONTIER__.renderer.worldToScreen(x,y);return document.elementFromPoint(p.x,p.y)?.id;
  },target)).toBe('world');
  // A ground-center anchor can land in transparent sprite padding. Read a
  // painted, unobscured body pixel instead; preserve the same native assertions.
  let point:{x:number;y:number;hit:string|undefined;picked:string|undefined}|null=null;
  await expect.poll(async()=>{
    point=await page.evaluate(({x,y,id})=>{
      const f=window.__FRONTIER__,center=f.renderer.worldToScreen(x,y);
      for(let dy=-36;dy<=-4;dy+=4)for(let dx=-24;dx<=24;dx+=4){
        const p={x:center.x+dx,y:center.y+dy};
        if(![-2,0,2].every(sx=>[-2,0,2].every(sy=>(f.renderer.pick(f.state,p.x+sx,p.y+sy) as {id?:string}|undefined)?.id===id)))continue;
        const clearance=navigator.maxTouchPoints>0?22:0;
        if(![-clearance,0,clearance].every(sx=>[-clearance,0,clearance].every(sy=>document.elementFromPoint(p.x+sx,p.y+sy)?.id==='world')))continue;
        return {...p,hit:document.elementFromPoint(p.x,p.y)?.id,picked:(f.renderer.pick(f.state,p.x,p.y) as {id?:string}|undefined)?.id};
      }
      return null;
    },target);
    return point?.picked;
  }).toBe(target.id);
  const resolved=point as unknown as {x:number;y:number;hit:string;picked:string};
  expect(resolved.hit).toBe('world');expect(resolved.picked).toBe(target.id);
  return {point:resolved,target};
}

test('explicit Move over a friendly sprite preserves the army and queues a destination',async({page})=>{
  await launch(page,{difficulty:'easy'});await pause(page);await action(page,'panel-orders').click();await action(page,'select-army').click();
  const troops=await page.evaluate(()=>window.__FRONTIER__.state.entities.filter(e=>e.team===0&&e.kind!=='building'&&e.hp>0).map(e=>e.id).sort());
  await action(page,'order-move').click();const {point}=await friendlyBuildingPoint(page);await tap(page,point);
  const command=await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.at(-1));
  await test.info().attach('native-target-observation',{body:JSON.stringify({command,selection:await page.locator('#selection-info').innerText()}),contentType:'application/json'});
  expect(command?.type).toBe('move');expect(command&&'entityIds'in command?command.entityIds?.sort():null).toEqual(troops);
  await expect(page.locator('#selection-info')).toContainText(`${troops.length} units selected`);
  const before=await page.evaluate(()=>{const c=window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='commander')!;return{x:c.x,y:c.y};});
  await resume(page);await expect.poll(()=>page.evaluate(p=>{const c=window.__FRONTIER__.state.entities.find(e=>e.team===0&&e.kind==='commander')!;return Math.hypot(c.x-p.x,c.y-p.y);},before)).toBeGreaterThan(.5);
  await page.screenshot({path:test.info().outputPath('explicit-move-friendly-sprite.png')});
});

test('Cancel and Army restore contextual selection after an explicit order',async({page})=>{
  await launch(page,{difficulty:'easy'});await pause(page);await action(page,'panel-orders').click();await action(page,'select-army').click();
  await action(page,'order-attackMove').click();await expect(action(page,'cancel-order')).toBeVisible();await action(page,'cancel-order').click();
  const {point}=await friendlyBuildingPoint(page);await tap(page,point);await expect(page.locator('#selection-info')).toContainText('Barracks');
  expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toHaveLength(0);
  await action(page,'select-army').click();await action(page,'panel-orders').click();await action(page,'order-move').click();await action(page,'select-commander').click();
  await expect(action(page,'cancel-order')).toHaveCount(0);
});

test('Attack-move takes one destination then restores friendly selection',async({page})=>{
  await launch(page,{difficulty:'easy'});await pause(page);await action(page,'select-army').click();await action(page,'panel-orders').click();
  const troops=await page.evaluate(()=>window.__FRONTIER__.state.entities.filter(e=>e.team===0&&e.kind!=='building'&&e.hp>0).map(e=>e.id).sort());
  await action(page,'order-attackMove').click();const cancel=action(page,'cancel-order'),box=(await cancel.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('#selection-info')).toContainText('Choose attack-move destination');
  const {point}=await friendlyBuildingPoint(page);await page.screenshot({path:test.info().outputPath('armed-attack-move-target.png')});await tap(page,point);
  const commands=await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands);
  expect(commands).toHaveLength(1);expect(commands[0].type).toBe('attackMove');
  expect('entityIds'in commands[0]?commands[0].entityIds?.sort():null).toEqual(troops);
  await expect(cancel).toHaveCount(0);await tap(page,point);await expect(page.locator('#selection-info')).toContainText('Barracks');
  expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toHaveLength(1);
});

test('Escape closes a dialog before canceling its pending destination',async({page})=>{
  await launch(page);await pause(page);await action(page,'select-army').click();await action(page,'panel-orders').click();await action(page,'order-move').click();
  await action(page,'economy').first().click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(action(page,'cancel-order')).toBeVisible();
  await page.keyboard.press('Escape');await expect(action(page,'cancel-order')).toHaveCount(0);expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toHaveLength(0);
});

test('Saving an unchosen destination does not persist a hidden order',async({page})=>{
  await launch(page);await pause(page);await action(page,'select-army').click();await action(page,'panel-orders').click();await action(page,'order-move').click();
  await action(page,'pause-menu').click();await action(page,'save-leave').click();await page.reload();await action(page,'continue').click();
  await expect(action(page,'cancel-order')).toHaveCount(0);expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toHaveLength(0);
  const {point}=await friendlyBuildingPoint(page);await tap(page,point);await expect(page.locator('#selection-info')).toContainText('Barracks');
});

test('Keep defeat offers advice and Practice after its result is durably saved',async({page})=>{
  await launch(page,{difficulty:'easy'});await pause(page);
  // Presentation/persistence fixture only; natural loss evidence is recorded separately.
  await page.evaluate(()=>{const s=window.__FRONTIER__.state;s.players[0].defeated=true;s.winner=1;s.victoryReason='All enemy Command Keeps destroyed';});
  await expect(page.locator('.defeat-guidance')).toContainText('Protect your keep');
  await expect(page.locator('.defeat-guidance')).toContainText('safe rally point');
  await expect(page.locator('#result-save-status')).toHaveText('Result saved on this device.');
  await page.screenshot({path:test.info().outputPath('defeat-advice-practice.png')});
  await page.locator('.defeat-guidance').scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('defeat-advice-scrolled.png')});
  const practice=page.getByRole('button',{name:'Practice the basics',exact:true});await practice.scrollIntoViewIfNeeded();
  const practiceBox=(await practice.boundingBox())!;expect(practiceBox.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:test.info().outputPath('practice-action-scrolled.png')});
  await practice.click();await page.getByRole('button',{name:'Start learning',exact:true}).click();
  await expect(page.locator('#battle-hint')).toContainText('LEARN TO COMMAND · 1/8');
  expect(await page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(1);
  await action(page,'pause-menu').click();await action(page,'save-leave').click();await page.reload();await action(page,'continue').click();
  await expect(page.locator('#battle-hint')).toContainText('LEARN TO COMMAND · 1/8');
  expect(await page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(1);
});

test('Practice cannot replace a defeat while its profile commit is blocked',async({page})=>{
  await page.addInitScript(()=>{
    const set=Storage.prototype.setItem;(window as any).__BLOCK_PROFILE__=true;
    Storage.prototype.setItem=function(key,value){if((window as any).__BLOCK_PROFILE__&&key==='frontier-command:rts-game:v1:profile')throw new DOMException('Full','QuotaExceededError');return set.call(this,key,value);};
  });
  await launch(page);await pause(page);
  await page.evaluate(()=>{const s=window.__FRONTIER__.state;s.players[0].defeated=true;s.winner=1;s.victoryReason='All enemy Command Keeps destroyed';});
  await expect(page.locator('#result-save-status')).toContainText('finished battle is saved');
  await page.getByRole('button',{name:'Practice the basics',exact:true}).click();await expect(page.locator('.result-dialog')).toBeVisible();
  expect(await page.evaluate(()=>window.__FRONTIER__.state.settings.learning)).not.toBe(true);
  await page.evaluate(()=>(window as any).__BLOCK_PROFILE__=false);await action(page,'result-save').click();
  await expect(page.locator('#result-save-status')).toHaveText('Result saved on this device.');
  await page.getByRole('button',{name:'Practice the basics',exact:true}).click();await expect(page.getByRole('button',{name:'Start learning',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.__FRONTIER__.profile.games)).toBe(1);
});
