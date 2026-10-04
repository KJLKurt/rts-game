import {test,expect,launch,action,pause} from './helpers';

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
