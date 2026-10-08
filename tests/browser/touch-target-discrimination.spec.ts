import {test, expect, launch, pause, action, tap, clearGround} from './helpers';

for (const theme of ['christmas', 'mythic']) {
  test(`${theme} native Focus tap cancels targeting while clear canvas queues Move`, async ({page}) => {
    await launch(page, {commander: 'ranger'});
    await pause(page);
    await page.evaluate(async theme => {
      await (window.__FRONTIER__.renderer as any).setVisualTheme(theme);
    }, theme);
    await action(page, 'select-commander').click();
    const initial = await page.evaluate(() => ({
      time: window.__FRONTIER__.state.time,
      profile: window.__FRONTIER__.profile,
      commander: window.__FRONTIER__.state.entities.find(e => e.team === 0 && e.kind === 'commander')!.id,
    }));
    await action(page, 'order-move').click();
    await expect(page.locator('.target-toolbar')).toContainText('Move');
    const focusControl = page.locator('.map-controls [data-action="focus"]');
    await expect(focusControl).toHaveCount(1);
    const focus = await focusControl.boundingBox();
    expect(focus).not.toBeNull();
    await tap(page, {x: focus!.x + focus!.width / 2, y: focus!.y + focus!.height / 2});
    await expect(page.locator('.target-toolbar')).toHaveCount(0);
    expect(await page.evaluate(() => window.__FRONTIER__.state.pendingCommands)).toHaveLength(0);

    await action(page, 'order-move').click();
    const ground = await clearGround(page);
    await page.evaluate(() => {
      (window as any).__nativeGroundTarget = null;
      document.addEventListener('pointerdown', event => {
        const element = event.target as HTMLElement;
        (window as any).__nativeGroundTarget = {id: element.id, action: element.closest('[data-action]')?.getAttribute('data-action') ?? null};
      }, {capture: true, once: true});
    });
    await tap(page, ground);
    expect(await page.evaluate(() => (window as any).__nativeGroundTarget)).toEqual({id: 'world', action: null});
    await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.pendingCommands.at(-1)))
      .toMatchObject({type: 'move', entityIds: [initial.commander]});
    expect(await page.evaluate(() => window.__FRONTIER__.state.pendingCommands)).toHaveLength(1);
    expect(await page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(true);
    expect(await page.evaluate(() => window.__FRONTIER__.state.time)).toBe(initial.time);
    expect(await page.evaluate(() => window.__FRONTIER__.profile)).toEqual(initial.profile);
    await page.screenshot({path: test.info().outputPath(`${theme}-native-focus-versus-ground.png`)});
    await test.info().attach('native-target-discrimination', {
      body: JSON.stringify({theme, focus, ground, actualCanvasPointerTarget: true, oneQueuedMove: true, focusCancelledWithoutOrder: true}, null, 2),
      contentType: 'application/json',
    });
  });
}
