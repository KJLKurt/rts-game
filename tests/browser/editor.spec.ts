import {readFile} from 'node:fs/promises';
import {test,expect,home,action,tap} from './helpers';

test('editor painting, save/open, export/import and test-map form a real round trip',async({page})=>{
 await home(page);await action(page,'editor').click();await action(page,'new-editor').click();
 await expect(page.locator('.editor-header')).toBeVisible();
 const original=await page.evaluate(()=>window.__FRONTIER__.state.map);
 await action(page,'brush-road').click();
 const target=await page.evaluate(()=>{
  const {state:s,renderer:r}=window.__FRONTIER__;
  for(let y=4;y<s.map.height-4;y++)for(let x=4;x<s.map.width-4;x++){
   const p=r.worldToScreen(x+.5,y+.5);
   if(document.elementFromPoint(p.x,p.y)?.id==='world'&&p.x>180&&p.x<innerWidth-20&&p.y>90&&p.y<innerHeight-90&&s.map.tiles[y*s.map.width+x]!=='road')return{...p,index:y*s.map.width+x};
  }
  throw new Error('No paintable visible tile');
 });
 await tap(page,target);await expect.poll(()=>page.evaluate(i=>window.__FRONTIER__.state.map.tiles[i],target.index)).toBe('road');
 await action(page,'save-map').click();await expect(page.getByRole('status')).toContainText(/Workshop saved/);
 const downloadPromise=page.waitForEvent('download');await action(page,'export-map').click();const download=await downloadPromise;
 const downloadedPath=await download.path();expect(downloadedPath).not.toBeNull();const exported=JSON.parse(await readFile(downloadedPath!,'utf8'));
 expect(exported.tiles[target.index]).toBe('road');expect(exported.seed).toBe(original.seed);
 await action(page,'exit-editor').click();await action(page,'load-editor').click();
 expect(await page.evaluate(()=>window.__FRONTIER__.state.map.seed)).toBe(original.seed);
 expect(await page.evaluate(i=>window.__FRONTIER__.state.map.tiles[i],target.index)).toBe('road');
 await action(page,'exit-editor').click();await page.locator('#import-map').setInputFiles({name:'round-trip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await expect(page.locator('.editor-header')).toBeVisible();await action(page,'validate-map').click();await expect(page.locator('#map-validation')).toContainText('Playable');
 await action(page,'test-map').click();await expect(page.locator('.hud')).toBeVisible();
 expect(await page.evaluate(()=>window.__FRONTIER__.state.map.seed)).toBe(original.seed);
});

test('malformed and structurally plausible invalid imports never corrupt active editor state',async({page})=>{
 await home(page);await action(page,'editor').click();
 for(const data of ['{broken',JSON.stringify({width:20,height:20,tiles:Array(400).fill('lava'),spawns:[{x:2,y:2},{x:18,y:18}],nodes:[]}),JSON.stringify({width:20,height:20,tiles:Array(400).fill('grass'),spawns:[{x:NaN,y:2},{x:18,y:18}],nodes:[]})]){
  await page.locator('#import-map').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(data)});
  await expect(page.getByRole('status')).toContainText(/not a supported Frontier map|invalid map/i);
  await expect(action(page,'new-editor')).toBeVisible();
 }
 await action(page,'new-editor').click();await expect(page.locator('.editor-header')).toBeVisible();
});
