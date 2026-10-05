import { test, expect, launch, action, pause, tap } from "./helpers";

test("dense troop counts include only visible on-screen living units and preserve native selection", async ({ page }) => {
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    (window as any).__TROOP_LABELS__ = [];
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
      if (text.includes("visible troops")) {
        const labels = (window as any).__TROOP_LABELS__ as string[];
        if (!labels.includes(text)) labels.push(text);
      }
      return original.call(this, text, ...args);
    };
  });
  await launch(page, { difficulty: "easy" }); await pause(page);
  if (!await page.locator(".command-deck").evaluate(el => el.classList.contains("collapsed"))) await action(page, "toggle-deck").click();
  const before = await page.evaluate(() => {
    // Controlled renderer fixture, never an earned match or gameplay outcome.
    // Keep the actual commander/buildings and use normal native controls after setup.
    const f=window.__FRONTIER__,s=f.state,c=s.entities.find(e=>e.team===0&&e.kind==="commander")!;
    const template=s.entities.find(e=>e.team===0&&e.kind==="unit")!;
    s.entities=s.entities.filter(e=>e.kind!=="unit");
    for(let i=0;i<12;i++)s.entities.push({...structuredClone(template),id:`visible-${i}`,x:c.x+2+(i%4)*.08,y:c.y+2+Math.floor(i/4)*.08,order:{type:"idle"}});
    const hiddenPoint={x:c.x+4,y:c.y+4};
    for(let i=0;i<12;i++)s.entities.push({...structuredClone(template),id:`hidden-${i}`,team:1,x:hiddenPoint.x,y:hiddenPoint.y,order:{type:"idle"}});
    s.fog.visible[0][Math.floor(hiddenPoint.y)*s.map.width+Math.floor(hiddenPoint.x)]=0;
    for(let i=0;i<8;i++)s.entities.push({...structuredClone(template),id:`offscreen-${i}`,x:31,y:31,order:{type:"idle"}});
    for(let i=0;i<6;i++)s.entities.push({...structuredClone(template),id:`dead-${i}`,hp:0,x:c.x+2,y:c.y+2});
    for(let i=0;i<6;i++)s.entities.push({...structuredClone(template),id:`recovering-${i}`,respawnAt:10000,x:c.x+2,y:c.y+2});
    const visible=s.entities.find(e=>e.id==="visible-0")!;
    s.fog.visible[0][Math.floor(visible.y)*s.map.width+Math.floor(visible.x)]=1;
    (window as any).__TROOP_LABELS__=[];
    return JSON.stringify(s);
  });
  await expect.poll(() => page.evaluate(() => (window as any).__TROOP_LABELS__)).toEqual(["You · 12 visible troops"]);
  await page.screenshot({ path: test.info().outputPath("dense-visible-troop-summary.png") });
  expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state))).toBe(before);
  await action(page,"select-army").click();
  await expect(page.locator("#selection-info")).toContainText("units selected");
  await action(page,"select-commander").click();
  const point=await page.evaluate(()=>{
    const f=window.__FRONTIER__,c=f.state.entities.find(e=>e.team===0&&e.kind==="commander")!,p=f.renderer.worldToScreen(c.x,c.y);
    return {...p,hit:document.elementFromPoint(p.x,p.y)?.id};
  });
  expect(point.hit).toBe("world");await tap(page,point);
  await expect(page.locator("#selection-info")).toContainText("Warlord");
  expect(await page.evaluate(()=>window.__FRONTIER__.state.pendingCommands)).toHaveLength(0);
  await test.info().attach("dense-render-fixture",{body:JSON.stringify({controlledPresentationFixture:true,visible:12,hidden:12,offscreen:8,dead:6,recovering:6,renderDidNotChangeSimulation:true,nativeSelectionPreserved:true}),contentType:"application/json"});
});
