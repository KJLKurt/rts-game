import { test, expect, action, launch, pause, tap, clearGround } from './helpers';

test('landscape placement keeps real touch targets and preview space at standard and larger text',async({page})=>{
  const viewport=page.viewportSize()!;
  test.skip(viewport.height>=500||viewport.width<=600,'Short-landscape placement regression.');
  await launch(page,{difficulty:'easy'});await pause(page);
  for(const scale of ['1','1.3']) {
    await action(page,'pause-menu').click();await action(page,'settings').click();
    await page.getByLabel('Interface text size',{exact:true}).selectOption(scale);
    const settings=page.getByRole('dialog',{name:'Settings',exact:true});
    await settings.getByRole('button',{name:'Done',exact:true}).click();await expect(settings).toHaveCount(0);
    await action(page,'panel-build').click();await page.getByRole('button',{name:'Build House',exact:true}).click();
    const toolbar=page.locator('.placement-toolbar');await expect(toolbar).toBeVisible();
    const geometry=await page.evaluate(()=>{
      const f=window.__FRONTIER__,c=f.state.entities.find(e=>e.team===0&&e.kind==='commander')!,feet=f.renderer.worldToScreen(c.x,c.y);
      const bar=document.querySelector('.placement-toolbar')!.getBoundingClientRect(),deck=document.querySelector('.command-deck')!.getBoundingClientRect();
      return{feet,hit:document.elementFromPoint(feet.x,feet.y)?.id,toolbar:{top:bar.top,bottom:bar.bottom,height:bar.height},deckTop:deck.top,height:innerHeight};
    });
    expect(geometry.hit).toBe('world');expect(geometry.toolbar.height).toBeLessThanOrEqual(geometry.height*.30+1);
    expect(geometry.toolbar.top).toBeGreaterThan(geometry.height*.55);
    expect(geometry.toolbar.bottom).toBeLessThanOrEqual(geometry.height);
    await tap(page,geometry.feet); // Native touch in the landscape-phone project, never force-click.
    expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toEqual([]);
    for(const name of ['cancel-build','placement-place','placement-pan','confirm-placement']) {
      const control=page.locator(`#placement-controls [data-action="${name}"]`);
      const bounds=(await control.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(await control.evaluate(el=>{const b=el.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('[data-action]')?.getAttribute('data-action');})).toBe(name);
    }
    await tap(page,await clearGround(page,true));await expect(action(page,'confirm-placement')).toBeEnabled();
    // Use the preserved selection-row Cancel on the first pass and confirm on the second.
    if(scale==='1')await page.locator('#placement-controls [data-action="cancel-build"]').click();
    else {await action(page,'confirm-placement').click();await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.pendingCommands.filter(c=>c.type==='build').length)).toBe(1);}
    await expect(toolbar).toHaveCount(0);await expect(action(page,'panel-build')).toBeVisible();
  }
  await page.screenshot({path:test.info().outputPath('landscape-placement-completed.png')});
});
