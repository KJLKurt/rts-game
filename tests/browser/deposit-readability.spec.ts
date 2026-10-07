import {test,expect,launch,pause} from './helpers';

for(const theme of ['christmas','mythic'])test(`${theme} deposits reveal every visible body and keep captions readable`,async({page})=>{
 await launch(page,{commander:'ranger'});await pause(page);
 const evidence=await page.evaluate(async theme=>{
  const live=window.__FRONTIER__,before=JSON.stringify(live.state),original=live.renderer as any;
  const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;z-index:10000;pointer-events:none';document.body.append(canvas);
  const r=new original.constructor(canvas);r.resize(innerWidth,innerHeight,devicePixelRatio);await r.setVisualTheme(theme);r.centerOn(8.5,8.5);r.camera.zoom=1;
  const source=structuredClone(live.state),commander=source.entities.find(e=>e.team===0&&e.kind==='commander')!;
  source.map.tiles.fill('grass');
  const results:any[]=[];
  for(const kind of ['gold','wood','relic']){
   const node={...source.map.nodes[0],id:'fixture-node',kind,x:8.5,y:8.5,owner:0,captureTeam:null,captureProgress:0,amount:1000,maxAmount:1000};
   for(const variant of ['commander','selected-unit','unselected-unit','enemy','front','outside','alpha-gap']){
    const actor={...commander,id:'fixture-actor',kind:variant.includes('unit')?'unit':'commander',type:variant.includes('unit')?'archer':'ranger',team:variant==='enemy'?1:0,x:variant==='front'?8.7:variant==='outside'?7:8.36,y:variant==='front'?8.7:variant==='outside'?9.5:8.36};
    if(variant==='alpha-gap'){
     const name=kind==='relic'?'relic-captured':`${kind}-full`,width=kind==='relic'?75:kind==='wood'?84:78,height=kind==='relic'?91:undefined,bounds=r.atlas.bounds(name,width,height);
     let gap:number|undefined;
     for(let x=bounds.x+1;x<bounds.x+bounds.width-1;x+=2){
      const ys=[.3,.5,.7].map(f=>-.28*18-59*f),inside=ys.filter(y=>y>=bounds.y&&y<=bounds.y+bounds.height).length,opaque=ys.filter(y=>r.atlas.hitTest(name,width,height,x,y)).length;
      if(inside>=2&&opaque<2){gap=x;break;}
     }
     if(gap===undefined)throw new Error(`${theme}/${kind}: no transparent-edge fixture found`);
     actor.x+=gap/72;actor.y-=gap/72;
    }
    const state={...structuredClone(source),entities:[actor],events:[],rush:undefined,map:{...structuredClone(source.map),nodes:[node]}},selection=variant==='selected-unit'?[actor.id]:[];
    const options={reveal:true,reducedMotion:true,showHealth:true};
    const alpha:number[]=[],draw=r.atlas.draw.bind(r.atlas);r.atlas.draw=(c:any,name:string,...args:any[])=>{if(name.startsWith(kind+'-'))alpha.push(c.globalAlpha);return draw(c,name,...args);};
    r.render(state,selection,options);
    const expected=['commander','selected-unit','unselected-unit','enemy'].includes(variant)?.3:1;
    if(alpha.at(-1)!==expected)throw new Error(`${theme}/${kind}/${variant}: opacity ${alpha.at(-1)}, expected ${expected}`);
    const p=r.worldToScreen(node.x,node.y),labelY=kind==='relic'?-94:kind==='wood'?-90:-75;
    const c=r.context,read=(x:number,y:number,w:number,h:number):number[]=>Array.from(c.getImageData(Math.round(x*r.dpr),Math.round(y*r.dpr),Math.round(w*r.dpr),Math.round(h*r.dpr)).data) as number[];
    const labelCalls:any[]=[],fillText=c.fillText.bind(c);c.fillText=(text:string,x:number,y:number,...args:any[])=>{if(text.startsWith('ANCIENT')||text.startsWith('YOUR')||text.startsWith('RIVAL')||text.startsWith('◆')||text.startsWith('▥')||text==='DEPLETED')labelCalls.push({text,alpha:c.globalAlpha,color:c.fillStyle,font:c.font,matrix:Array.from([c.getTransform().e,c.getTransform().f])});return fillText(text,x,y,...args);};
    r.render(state,selection,options);
    const label=labelCalls.at(-1),pick=r.pick(state,p.x,p.y-15)?.id;
    const opacity=r.nodeOpacity.bind(r);r.nodeOpacity=()=>1;r.render(state,selection,options);
    const baselineLabel=labelCalls.at(-1),baselinePick=r.pick(state,p.x,p.y-15)?.id;
    if(JSON.stringify(label)!==JSON.stringify(baselineLabel)||label.alpha!==1)throw new Error(`${theme}/${kind}/${variant}: caption drawing changed`);
    if(pick!==baselinePick&&pick!=='fixture-actor')throw new Error(`${theme}/${kind}/${variant}: faded art intercepted a visible actor`);
    let pixels:any;
    if(variant==='commander'){
     const point=r.worldToScreen(actor.x,actor.y),box={x:point.x-18,y:point.y-55,w:36,h:42};
     const body=()=>read(box.x,box.y,box.w,box.h),opaque=body(),beforePNG=canvas.toDataURL('image/png');
     r.nodeOpacity=opacity;r.render(state,selection,options);const faded=body(),afterPNG=canvas.toDataURL('image/png');
     r.render({...state,map:{...state.map,nodes:[]}},selection,options);const reference=body();
     r.render({...state,entities:[],map:{...state.map,nodes:[]}},[],options);const ground=body();
     let count=0,opaqueError=0,fadedError=0;
     for(let i=0;i<reference.length;i+=4){
      if(Math.abs(reference[i]-ground[i])+Math.abs(reference[i+1]-ground[i+1])+Math.abs(reference[i+2]-ground[i+2])<60)continue;
      count++;for(let j=0;j<3;j++){opaqueError+=Math.abs(opaque[i+j]-reference[i+j]);fadedError+=Math.abs(faded[i+j]-reference[i+j]);}
     }
     if(count<40||fadedError>=opaqueError*.85)throw new Error(`${theme}/${kind}: protected-body pixel error did not improve (${count}, ${opaqueError}, ${fadedError})`);
     pixels={count,opaqueError,fadedError,reduction:1-fadedError/opaqueError,beforePNG,afterPNG};
    }
    r.nodeOpacity=opacity;r.atlas.draw=draw;c.fillText=fillText;results.push({kind,variant,opacity:expected,captionDrawingIdentical:true,captionGlobalAlpha:label.alpha,pickWithFade:pick,pickWithoutFade:baselinePick,visibleActorPassThroughAllowed:true,pixels});
   }
  }
  if(JSON.stringify(live.state)!==before)throw new Error('Presentation fixture modified live simulation');
  canvas.remove();return{theme,liveSimulationUnchanged:true,results};
 },theme);
 const fs=await import('node:fs/promises');
 for(const row of evidence.results)if(row.pixels){
  for(const when of ['before','after']){
   await fs.writeFile(test.info().outputPath(`${theme}-${row.kind}-${when}-render-fixture.png`),Buffer.from(row.pixels[`${when}PNG`].split(',')[1],'base64'));
   delete row.pixels[`${when}PNG`];
  }
 }
 await fs.writeFile(test.info().outputPath(`${theme}-deposit-pixel-verification.json`),JSON.stringify(evidence,null,2));
 expect(evidence.liveSimulationUnchanged).toBe(true);
});
