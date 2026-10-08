import { test, expect, action, home, launch } from './helpers';

test('ordinary field-guide close and expanded map have separate hit targets',async({page})=>{
  test.skip((page.viewportSize()?.height??900)<500,'Ordinary tips intentionally hide in short landscape; eight-lesson guide is separate.');
  await launch(page,{keepTips:true});
  const mapToggle=action(page,'toggle-minimap');
  if(await mapToggle.getAttribute('aria-expanded')==='false')await mapToggle.click();
  const close=action(page,'dismiss-tips');await expect(close).toBeVisible();
  const geometry=await close.evaluate(el=>{
    const close=el.getBoundingClientRect(),hint=el.parentElement!.getBoundingClientRect(),map=document.querySelector('.minimap-wrap')!.getBoundingClientRect();
    return {width:close.width,height:close.height,overlap:hint.left<map.right&&hint.right>map.left&&hint.top<map.bottom&&hint.bottom>map.top,hit:document.elementFromPoint(close.x+close.width/2,close.y+close.height/2)?.closest('[data-action]')?.getAttribute('data-action')};
  });
  expect(geometry).toMatchObject({overlap:false,hit:'dismiss-tips'});
  expect(geometry.width).toBeGreaterThanOrEqual(44);expect(geometry.height).toBeGreaterThanOrEqual(44);
  await close.click();await expect(close).toHaveCount(0);await expect(mapToggle).toHaveAttribute('aria-expanded','true');
  expect(await page.locator('#minimap').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.id;})).toBe('minimap');
});

test('Rush Engineer abilities stay above expanded and collapsed command panels and receive clicks',async({page})=>{
  await home(page);await action(page,'rush').click();
  await page.locator('[data-action="rush-commander"][data-id="engineer"]').click();
  await action(page,'launch-rush').click();
  await expect(page.getByRole('button',{name:'Runic Turret',exact:true})).toBeVisible();
  for(let cycle=0;cycle<3;cycle++) {
    await action(page,'toggle-deck').click();
    await expect.poll(()=>page.locator('.ability-dock').evaluate(el=>{
      const dock=el.getBoundingClientRect(),deck=document.querySelector('.command-deck')!.getBoundingClientRect();
      return dock.bottom <= deck.top-7;
    })).toBe(true);
    for(const id of ['turret','repair','breach'])expect(await page.locator(`[data-action="ability"][data-id="${id}"]`).evaluate(el=>{
      const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest<HTMLButtonElement>('[data-action]');
      return {action:hit?.dataset.action,id:hit?.dataset.id};
    })).toEqual({action:'ability',id});
  }
  await page.getByRole('button',{name:'Runic Turret',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__FRONTIER__.state.entities.some(e=>e.team===0&&e.type==='turret'))).toBe(true);
  await page.screenshot({path:test.info().outputPath('rush-engineer-uncovered-controls.png')});
});

test('Rush status growth relocates controls without needing a resize or panel toggle',async({page})=>{
  await home(page);await action(page,'rush').click();await action(page,'launch-rush').click();
  await action(page,'toggle-deck').click();
  // Explicit layout fixture: mimic a wrapped status/upgrade panel changing natural height.
  await page.locator('#rush-status').evaluate(el=>(el as HTMLElement).style.minHeight='220px');
  await expect.poll(()=>page.locator('.ability-dock').evaluate(el=>{
    const dock=el.getBoundingClientRect(),deck=document.querySelector('.command-deck')!.getBoundingClientRect();
    return dock.bottom<=deck.top-7;
  })).toBe(true);
});
