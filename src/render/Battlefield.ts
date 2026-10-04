import type { Entity, GameEvent, GameMap, GameState, Point, ResourceNode, TerrainType } from '../sim/types';
import { TILE_W, TILE_H, building, diamond, ellipse, flag, hash, line, palette, poly, rock, shadow, tree, unit, type Ctx } from './art';
import { SpriteAtlas } from './SpriteAtlas';

export interface RenderOptions {
 time?:number; reveal?:boolean; quality?:'low'|'high'; reducedMotion?:boolean; team?:number;
 placement?:{type:string;x:number;y:number;valid:boolean;size?:number};
 target?:{x:number;y:number;radius?:number}; dragRect?:{x:number;y:number;w:number;h:number};
 hoverId?:string|null; showHealth?:boolean;
}
interface Decoration {x:number;y:number;kind:'tree'|'rock'|'ruin';variant:number;size:number;}
interface TerrainCache {map:GameMap;signature:string;canvas:HTMLCanvasElement;ox:number;oy:number;width:number;height:number;decor:Decoration[];water:Point[];}
interface RenderItem {x:number;y:number;order:number;kind:'decor'|'node'|'entity';value:Decoration|ResourceNode|Entity;}
const TAU=Math.PI*2;
const terrainCode:Record<TerrainType,number>={grass:1,forest:2,water:3,rock:4,sand:5,snow:6,road:7,marsh:8};
const terrainColors:Record<string,Record<TerrainType,string[]>> = {
 grasslands:{grass:['#78996d','#7e9d70','#829f73','#78976b'],forest:['#597b59','#64855e','#61815e'],water:['#426f7a','#467782','#507f86'],rock:['#829385','#8b9885'],sand:['#b7ac7e','#c0b487'],snow:['#d1ded4','#c5d6cd'],road:['#a59d76','#b0a681'],marsh:['#668779','#6c8e7b']},
 forest:{grass:['#6d8f67','#73976e','#6e936a'],forest:['#456e54','#537a59','#4d7658'],water:['#3e7073','#417675'],rock:['#778c7d','#7e9280'],sand:['#b0aa7f'],snow:['#ceddd4'],road:['#a1a17c','#a8a581'],marsh:['#5b8073']},
 desert:{grass:['#b5ab7c','#bcaf80','#afa477'],forest:['#8d9863','#92985f'],water:['#4d8b93','#51979b'],rock:['#ad9d7c','#b2a683'],sand:['#cabb8a','#d1bf8e','#c6b583'],snow:['#e1ddd0'],road:['#b2a17a','#bfae7c'],marsh:['#7c9a7f']},
 snow:{grass:['#b3c9bf','#bcd0c6','#afc7bd'],forest:['#95b2a6','#a6beb1'],water:['#7096a0','#739ca4'],rock:['#98aea7','#a9bdb4'],sand:['#c6c9b3'],snow:['#d9e5dd','#d2e1d7','#dfebe1'],road:['#b2c5bd','#bbccc2'],marsh:['#96b5ad']},
};

/** Isometric view. This class only reads simulation state and uses CSS-pixel input coordinates. */
export class Battlefield {
 readonly canvas:HTMLCanvasElement;
 readonly context:Ctx;
 readonly camera={x:8,y:8,zoom:1};
 readonly atlas=new SpriteAtlas();
 width=1;height=1;dpr=1;
 private terrain:TerrainCache|null=null;
 private fogCanvas:HTMLCanvasElement;
 private fogStamp='';
 private lastState:GameState|null=null;
 private lastOptions:RenderOptions={};
 private spriteCache=new Map<string,HTMLCanvasElement>();
 private lastTime=0;
 private visualPositions=new Map<string,Point>();
 private rememberedNodes=new Map<string,ResourceNode>();
 private frameTime=0;
 constructor(canvas:HTMLCanvasElement){
  this.canvas=canvas;const c=canvas.getContext('2d',{alpha:false});if(!c)throw new Error('Canvas2D is unavailable');this.context=c;this.fogCanvas=document.createElement('canvas');
  void this.loadAtlas(`${import.meta.env?.BASE_URL??'./'}assets/render/frontier-atlas.json`);
 }
 resize(width:number,height:number,dpr=window.devicePixelRatio||1){
  this.width=Math.max(1,width);this.height=Math.max(1,height);this.dpr=Math.min(2,Math.max(1,dpr));
  this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);
  this.canvas.style.width=`${this.width}px`;this.canvas.style.height=`${this.height}px`;
 }
 loadAtlas(url:string){return this.atlas.load(url);}
 private origin():Point {return {x:this.width/2-(this.camera.x-this.camera.y)*TILE_W/2*this.camera.zoom,y:this.height/2-(this.camera.x+this.camera.y)*TILE_H/2*this.camera.zoom};}
 worldToScreen(x:number,y:number):Point {const o=this.origin();return{x:o.x+(x-y)*TILE_W/2*this.camera.zoom,y:o.y+(x+y)*TILE_H/2*this.camera.zoom};}
 screenToWorld(x:number,y:number):Point {const o=this.origin(),a=(x-o.x)/(TILE_W/2*this.camera.zoom),b=(y-o.y)/(TILE_H/2*this.camera.zoom);return{x:(a+b)/2,y:(b-a)/2};}
 centerOn(x:number,y:number){this.camera.x=x;this.camera.y=y;}
 pan(dx:number,dy:number){const a=dx/(TILE_W/2*this.camera.zoom),b=dy/(TILE_H/2*this.camera.zoom);this.camera.x-=(a+b)/2;this.camera.y-=(b-a)/2;this.constrainCamera();}
 zoomAt(scale:number,x=this.width/2,y=this.height/2){const before=this.screenToWorld(x,y);this.camera.zoom=Math.min(2.4,Math.max(.42,this.camera.zoom*scale));const after=this.screenToWorld(x,y);this.camera.x+=before.x-after.x;this.camera.y+=before.y-after.y;this.constrainCamera();}
 private constrainCamera(){if(this.lastState){this.camera.x=Math.max(-2,Math.min(this.lastState.map.width+1,this.camera.x));this.camera.y=Math.max(-2,Math.min(this.lastState.map.height+1,this.camera.y));}}
 invalidateTerrain(){this.terrain=null;this.fogStamp='';}
 private visible(state:GameState,x:number,y:number,explored=false,options=this.lastOptions){
  if(options.reveal)return true;const map=state.map,ix=Math.floor(x),iy=Math.floor(y);if(ix<0||iy<0||ix>=map.width||iy>=map.height)return false;
  const field=explored?state.fog.explored:state.fog.visible;return !!field[options.team??0]?.[iy*map.width+ix];
 }
 private inFrame(x:number,y:number,padding=160){const p=this.worldToScreen(x,y);return p.x>-padding&&p.x<this.width+padding&&p.y>-padding&&p.y<this.height+padding;}
 pick(state:GameState,x:number,y:number):Entity|ResourceNode|undefined{
  // Screen silhouettes permit tapping roofs and characters, rather than only their ground point.
  const candidates=state.entities.filter(e=>e.hp>0&&(e.team===(this.lastOptions.team??0)||this.visible(state,e.x,e.y))).sort((a,b)=>(b.x+b.y)-(a.x+a.y));
  for(const e of candidates){const p=this.worldToScreen(e.x,e.y),z=this.camera.zoom;const w=(e.kind==='building'?e.type==='keep'?64:43:e.type==='siege'||e.type==='cavalry'?27:e.kind==='commander'?40:24)*z;const h=(e.kind==='building'?90:e.kind==='commander'?60:44)*z;if(x>p.x-w&&x<p.x+w&&y>p.y-h&&y<p.y+12*z)return e;}
  const p=this.screenToWorld(x,y);return state.map.nodes.find(n=>this.visible(state,n.x,n.y,true)&&Math.hypot(n.x-p.x,n.y-p.y)<Math.max(1,n.radius));
 }
 render(state:GameState,selection:Iterable<string|number>=[],options:RenderOptions={}){
  if(this.lastState&&this.lastState.map!==state.map){this.visualPositions.clear();this.rememberedNodes.clear();}
  this.lastState=state;this.lastOptions=options;const selected=new Set(Array.from(selection,String));const c=this.context,z=this.camera.zoom,o=this.origin();
  const t=options.reducedMotion?state.time:options.time??state.time;this.lastTime=t;
  const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-this.frameTime)/1000));this.frameTime=now;
  const blend=1-Math.exp(-dt*22);
  c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#101f28';c.fillRect(0,0,this.width,this.height);
  const terrain=this.ensureTerrain(state.map);
  c.save();c.translate(o.x,o.y);c.scale(z,z);c.imageSmoothingEnabled=true;
  c.drawImage(terrain.canvas,-terrain.ox,-terrain.oy,terrain.width,terrain.height);
  if(options.quality!=='low'&&!options.reducedMotion)this.drawWater(c,terrain.water,t);
  c.restore();
  const items:RenderItem[]=[];
  for(const d of terrain.decor)if(this.inFrame(d.x,d.y,100)&&this.visible(state,d.x,d.y,true,options))items.push({x:d.x,y:d.y,order:d.x+d.y,kind:'decor',value:d});
  for(const n of state.map.nodes){
   const seen=this.visible(state,n.x,n.y,false,options);if(seen)this.rememberedNodes.set(n.id,{...n});
   if(this.inFrame(n.x,n.y)&&this.visible(state,n.x,n.y,true,options)){const known=seen?n:this.rememberedNodes.get(n.id)??{...n,owner:null,captureTeam:null,captureProgress:0};items.push({x:n.x,y:n.y,order:n.x+n.y+.08,kind:'node',value:known});}
  }
  const liveIds=new Set<string>();
  for(const e of state.entities){
   liveIds.add(e.id);let position=this.visualPositions.get(e.id);
   if(!position||e.kind==='building'||Math.hypot(position.x-e.x,position.y-e.y)>2){position={x:e.x,y:e.y};this.visualPositions.set(e.id,position);}
   else{position.x+=(e.x-position.x)*blend;position.y+=(e.y-position.y)*blend;}
   if(e.hp>0&&e.respawnAt===null&&this.inFrame(position.x,position.y)&&(e.team===(options.team??0)||this.visible(state,e.x,e.y,false,options)))items.push({x:position.x,y:position.y,order:position.x+position.y+.1,kind:'entity',value:e});
  }
  for(const id of this.visualPositions.keys())if(!liveIds.has(id))this.visualPositions.delete(id);
  items.sort((a,b)=>a.order-b.order);
  // Ground orders and command markers stay below the silhouettes.
  for(const e of state.entities)if(selected.has(e.id)&&e.hp>0)this.drawOrder(c,e,z);
  for(const item of items){const p=this.worldToScreen(item.x,item.y);c.save();c.translate(p.x,p.y);c.scale(z,z);
   if(item.kind==='decor')this.drawDecoration(c,item.value as Decoration,state.map.biome);
   else if(item.kind==='node')this.drawNode(c,item.value as ResourceNode,state,selected.has((item.value as ResourceNode).id),t,options);
   else this.drawEntity(c,item.value as Entity,selected.has((item.value as Entity).id),t,state,options);
   c.restore();
  }
  for(const event of state.events)if(this.visible(state,event.x,event.y,false,options))this.drawEvent(c,event,state,t,options);
  this.drawFog(c,state,options);
  if(options.placement)this.drawPlacement(c,options.placement,t);
  if(options.target){const p=this.worldToScreen(options.target.x,options.target.y);c.save();c.translate(p.x,p.y);c.scale(z,z);const r=options.target.radius??2;ellipse(c,0,0,r*TILE_W/2,r*TILE_H/2,'#8be7ff15','#a4efff',1.5);diamond(c,0,0,10,5,'#a5f0ff55','#daffff',1);line(c,[-18,0,18,0],'#d4ffff80',1);line(c,[0,-10,0,10],'#d4ffff80',1);c.restore();}
  if(options.dragRect){const r=options.dragRect;c.fillStyle='#a4e9ff15';c.strokeStyle='#a5e9ed';c.lineWidth=1;c.fillRect(r.x,r.y,r.w,r.h);c.strokeRect(r.x+.5,r.y+.5,r.w,r.h);}
  // A very restrained time-of-day tint never affects gameplay visibility.
  const dusk=(1-Math.cos(state.time/600))*.025;c.fillStyle=`rgba(35,52,92,${dusk})`;c.fillRect(0,0,this.width,this.height);
  // Gentle edge falloff keeps the centre readable on small screens.
  const vignette=c.createRadialGradient(this.width*.5,this.height*.5,this.height*.15,this.width*.5,this.height*.5,Math.max(this.width,this.height)*.7);vignette.addColorStop(0,'#06121d00');vignette.addColorStop(1,'#06121d44');c.fillStyle=vignette;c.fillRect(0,0,this.width,this.height);
 }
 private ensureTerrain(map:GameMap):TerrainCache{
  // Include tile signature so in-place level-editor paint invalidates this immutable visual cache.
  let sum=0;for(let i=0;i<map.tiles.length;i++)sum=(Math.imul(sum,31)+terrainCode[map.tiles[i]])|0;
  const signature=`${map.width},${map.height},${map.biome},${sum}`;
  if(this.terrain?.map===map&&this.terrain.signature===signature)return this.terrain;
  const canvas=document.createElement('canvas'),ox=map.height*TILE_W/2+70,oy=90;
  const width=(map.width+map.height)*TILE_W/2+140,height=(map.width+map.height)*TILE_H/2+130;
  // Bound texture memory and avoid the 4096px canvas limit of older mobile GPUs.
  const resolution=Math.min(1,4096/width);canvas.width=Math.ceil(width*resolution);canvas.height=Math.ceil(height*resolution);
  const c=canvas.getContext('2d')!;c.scale(resolution,resolution);c.translate(ox,oy);const colors=terrainColors[map.biome]??terrainColors.grasslands,decor:Decoration[]=[],water:Point[]=[];
  for(let sumXY=0;sumXY<map.width+map.height-1;sumXY++)for(let x=Math.max(0,sumXY-map.height+1);x<=Math.min(map.width-1,sumXY);x++){
   const y=sumXY-x,type=map.tiles[y*map.width+x],px=(x-y)*TILE_W/2,py=(x+y+1)*TILE_H/2,r=hash(x,y),colorset=colors[type]??colors.grass;
   if(x===map.width-1||y===map.height-1){poly(c,[px-36,py,px,py+18,px+36,py,px+36,py+16,px,py+34,px-36,py+16],'#354c46');line(c,[px-35,py+9,px,py+27,px+35,py+9],'#79917440',1);}
   diamond(c,px,py,36.4,18.35,colorset[Math.floor(r*colorset.length)]);
   if(type==='water'){water.push({x:x+.5,y:y+.5});diamond(c,px,py+1,31,13,'#c8e2db05');if(hash(x,y,2)>.4)line(c,[px-16,py+3,px-5,py+3,px+1,py+2],'#a6d0c231',1);continue;}
   // Tiny highlights are deliberately not a visible tile grid.
   if(r>.75)poly(c,[px-29,py,px-5,py-11,px+19,py-3,px-3,py+7],type==='snow'?'#ffffff15':'#f8f1b00a');
   for(let k=0;k<3;k++){const u=hash(x,y,k+2)-.5,v=hash(x,y,k+7)-.5,dx=(u-v)*28,dy=(u+v)*14;
    if(type==='road'||type==='sand'){ellipse(c,px+dx,py+dy,.6+hash(x,y,k)*.9,.4,'#756e5940');}
    else if(hash(x,y,k+19)>.48){line(c,[px+dx-2,py+dy,px+dx-1,py+dy-2,px+dx,py+dy],type==='snow'?'#97aea566':'#365e3545',.7);if(k===1&&r>.86)ellipse(c,px+dx+3,py+dy-2,1,.75,map.biome==='desert'?'#e6cd77':'#f4df9c');}
   }
   if(type==='forest'){
    decor.push({x:x+.5+hash(x,y,31)*.3-.15,y:y+.5+hash(x,y,32)*.3-.15,kind:'tree',variant:Math.floor(hash(x,y,33)*9),size:.75+hash(x,y,34)*.28});
    if(r>.72)decor.push({x:x+.23,y:y+.85,kind:'tree',variant:2,size:.5+hash(x,y,41)*.16});
   }else if(type==='rock')decor.push({x:x+.5,y:y+.5,kind:'rock',variant:r,size:.9+r*.7});
   else if(type==='grass'&&r>.985&&!map.spawns.some(p=>Math.hypot(p.x-x,p.y-y)<5)&&!map.nodes.some(p=>Math.hypot(p.x-x,p.y-y)<2))decor.push({x:x+.5,y:y+.5,kind:'ruin',variant:r,size:.7});
   if(type==='marsh'&&r>.3){for(let k=0;k<4;k++){const dx=(k-1.5)*6;line(c,[px+dx,py+2,px+dx-2,py-5-hash(x,y,k)*4],'#395e46',1);ellipse(c,px+dx-2,py-5-hash(x,y,k)*4,1,2,'#8a8462');}}
  }
  this.terrain={map,signature,canvas,ox,oy,width,height,decor,water};this.fogStamp='';return this.terrain;
 }
 private drawWater(c:Ctx,points:Point[],t:number){for(const p of points){if(!this.inFrame(p.x,p.y,60)||hash(p.x,p.y)<.65)continue;const x=(p.x-p.y)*TILE_W/2,y=(p.x+p.y)*TILE_H/2,s=Math.sin(t*.9+p.x*.7+p.y);c.globalAlpha=.15+s*.07;line(c,[x-12+s*2,y+3,x+2+s*2,y+3],'#dbefdb',1.1);}c.globalAlpha=1;}
 private drawDecoration(c:Ctx,d:Decoration,biome:string){
  const key=`${d.kind}/${Math.floor(d.variant*3)}/${biome}/${d.kind==='tree'?d.variant:0}`;let sprite=this.spriteCache.get(key);
  if(!sprite){sprite=document.createElement('canvas');sprite.width=100;sprite.height=110;const sc=sprite.getContext('2d')!;sc.translate(50,99);
   if(d.kind==='tree')tree(sc,d.variant,biome);else if(d.kind==='rock')rock(sc,d.variant,1.25);else{shadow(sc,16,7,.15);poly(sc,[-8,0,-9,-27,3,-31,10,-25,9,-1],'#839087');poly(sc,[-9,-27,3,-31,10,-25,0,-22],'#bcc4a8');line(sc,[-7,-15,7,-20],'#536e62',1);ellipse(sc,-9,0,9,3,'#5e845a');}
   this.spriteCache.set(key,sprite);
  }c.drawImage(sprite,-50*d.size,-99*d.size,100*d.size,110*d.size);
 }
 private drawNode(c:Ctx,n:ResourceNode,state:GameState,selected:boolean,t:number,options:RenderOptions){
  const p=palette(n.owner??-1),capturing=n.captureTeam!==null&&n.captureProgress>0;
  const finite=n as ResourceNode & {amount?:number;maxAmount?:number};const remaining=finite.amount??1000,max=finite.maxAmount??1000,ratio=remaining/max;
  const depletion=remaining<=0?'empty':ratio<.3?'sparse':ratio<.65?'half':'full';
  ellipse(c,0,2,n.kind==='relic'?40:35,n.kind==='relic'?20:17,selected?'#f7d88716':'#223c4314',selected?'#ffe1a1':n.owner===null?'#cdbd7d55':`${p.main}aa`,selected?2:1);
  if(capturing){c.save();c.scale(1,.5);c.beginPath();c.arc(0,2,n.kind==='relic'?42:37,-Math.PI/2,-Math.PI/2+TAU*n.captureProgress);c.strokeStyle=palette(n.captureTeam!).main;c.lineWidth=4;c.stroke();c.restore();}
  if(n.kind==='relic'){
   const gl=c.createRadialGradient(0,-30,2,0,-15,64);gl.addColorStop(0,n.owner===null?'#ffdda346':`${p.main}60`);gl.addColorStop(1,'#ffdfa000');c.fillStyle=gl;c.fillRect(-70,-90,140,120);
   const image=this.atlas.draw(c,n.owner===null?'relic-neutral':capturing?'relic-contested':'relic-captured',75,91);
   if(!image){
    shadow(c,28,12,.25);diamond(c,0,-1,29,15,'#9a9e86','#c7c5a1',1);diamond(c,0,-6,22,11,'#697e76','#b7be9e',1);diamond(c,0,-13,16,8,'#bbc6a6','#e3d7a5',1);
    for(const s of [-1,1]){poly(c,[s*18,-12,s*24,-14,s*23,-38,s*17,-40],'#8a9d8e');ellipse(c,s*20,-40,3,2,'#eadcae');}
    const bob=options.reducedMotion?0:Math.sin(t*2)*2;
    poly(c,[0,-68+bob,11,-47+bob,0,-29+bob,-11,-47+bob],n.owner===null?'#f1d884':p.main,'#fff4c8',1.2);poly(c,[0,-68+bob,11,-47+bob,0,-29+bob],n.owner===null?'#b79d4c':p.dark);
    ellipse(c,0,-45,20,10,'#fff2bf00','#ecdb9c66',1);
   }
   if(!options.reducedMotion)for(let i=0;i<5;i++){const a=t*.5+i*TAU/5,x=Math.cos(a)*25,y=-29+Math.sin(a)*12;ellipse(c,x,y,1.3,1.3,'#ffe9a8');}
  } else {
   const image=this.atlas.draw(c,`${n.kind}-${depletion}`,n.kind==='wood'?84:78);
   if(!image&&n.kind==='gold'){
    shadow(c,25,11,.24);c.save();c.translate(-12,-4);rock(c,.9,1.2,remaining>0);c.restore();c.save();c.translate(13,0);rock(c,.2,.85,remaining>0);c.restore();
    if(remaining>0){poly(c,[-8,-5,-8,-21,-2,-27,4,-26,11,-21,11,-3],'#333f3d','#bbaa7c',3);line(c,[-11,-24,0,-32,14,-23],'#c7b18a',4);line(c,[-7,-2,5,3,18,-3],'#8e7956',2);ellipse(c,-17,2,5,3,'#e5b94a');}
   }else if(!image&&n.kind==='wood'){
    if(remaining>0){c.save();c.translate(-10,-6);tree(c,0,state.map.biome,.78);c.restore();if(ratio>.3){c.save();c.translate(14,0);tree(c,1,state.map.biome,.64);c.restore();}}
    for(let i=0;i<3;i++){const xx=-17+i*8;poly(c,[xx,4,xx+15,-3,xx+15,-7,xx,-1],'#7a5d3e');ellipse(c,xx,1,4,4,'#c2a16d','#694f36',1);ellipse(c,xx,1,2,2,'#a98753');}
   }
   if(n.owner!==null)flag(c,24,-3,n.owner,t,true);
  }
  // Resource balances are visible only while that point is currently observable.
  if(this.visible(state,n.x,n.y,false,options)){
   const text=n.kind==='relic'?(n.owner===null?'ANCIENT RELIC':n.owner===(options.team??0)?'YOUR RELIC':'RIVAL RELIC'):remaining<=0?'DEPLETED':`${n.kind==='gold'?'◆':'▥'} ${remaining>=1000?`${(remaining/1000).toFixed(1)}k`:Math.round(remaining)}`;
   const labelY=n.kind==='relic'?-94:n.kind==='wood'?-90:-75;c.font='600 9px system-ui, sans-serif';const w=c.measureText(text).width+12;
   c.fillStyle='#11252bd9';c.beginPath();c.roundRect(-w/2,labelY-11,w,16,4);c.fill();c.strokeStyle=n.kind==='relic'?'#b9a76a88':`${p.main}55`;c.lineWidth=.6;c.stroke();c.fillStyle=n.kind==='relic'?'#ffe8ad':n.kind==='gold'?'#ebcc8a':'#c8deb2';c.textAlign='center';c.fillText(text,0,labelY);
  }
 }
 private drawEntity(c:Ctx,e:Entity,selected:boolean,t:number,state:GameState,options:RenderOptions){
  const team=options.team??0,p=palette(e.team),buildingEntity=e.kind==='building',commander=e.kind==='commander';
  const damaged=e.hp<e.maxHp;const active=e.order.type!=='idle'&&e.order.type!=='hold';const attacking=e.targetId!==null&&e.attackCooldown>e.attackPeriod*.55;
  const move=active&&e.path.length>0;const phase=hash(e.id.length,e.id.charCodeAt(e.id.length-1))*TAU;
  const rw=buildingEntity?e.radius*TILE_W/2+12:commander?29:e.type==='siege'||e.type==='cavalry'?20:15;
  // Team identity combines a blue cross / coral diamond and a thick two-tone ground marker.
  if(selected||commander){ellipse(c,0,2,rw+4,(rw+4)*.48,`${p.main}12`,selected?p.light:`${p.main}b0`,selected?1.8:1.1);}
  if(!buildingEntity){ellipse(c,0,2,rw,rw*.43,`${p.dark}b0`,p.main,1.3);if(e.team===1)diamond(c,0,4,4,2.8,p.light);else{line(c,[-3,4,3,4],p.light,1.3);line(c,[0,2,0,6],p.light,1.3);}}
  if(e.buffUntil>state.time){ellipse(c,0,1,rw+8+Math.sin(t*2)*2,(rw+8)*.48,'#ffdd7a10','#ffe0a777',1.1);}
  if(e.invulnerableUntil>state.time){ellipse(c,0,-20,rw+6,32,'#b6f6ff15','#b6f6ff77',1);}
  if(buildingEntity){
   c.save();if(e.buildProgress<1)c.globalAlpha=.35+e.buildProgress*.65;
   const drawWidth=e.type==='keep'?132:e.type==='tower'?66:e.type==='house'?87:103;
   const drawHeight=e.type==='keep'?123:e.type==='tower'?99:e.type==='house'?78:90;
   const drawn=this.atlas.draw(c,e.type==='turret'?'tower':e.type,drawWidth);
   if(!drawn)building(c,e.type==='turret'?'tower':e.type,e.team,t);else flag(c,e.type==='keep'?34:24,-drawHeight*.49,e.team,t,e.type!=='keep');
   c.restore();
   if(e.buildProgress<1){for(let sx=-1;sx<=1;sx+=2){line(c,[sx*35,0,sx*35,-44],'#cfb782',2);line(c,[-35,-14,-35,-30,35,-30,35,-14,-35,-14,35,-39],'#ba9b68',1.3);}this.bar(c,0,11,58,4,e.buildProgress,'#edcf85');}
   if(damaged&&e.hp/e.maxHp<.4&&!options.reducedMotion){for(let i=0;i<3;i++){const rise=(t*15+i*11)%30;ellipse(c,-10+i*12,-50-rise,5+rise*.13,6+rise*.15,`rgba(38,41,40,${.35-rise*.007})`);}}
  }else{
   const bob=options.reducedMotion?0:move?Math.sin(t*10+phase)*1.8:Math.sin(t*1.8+phase)*.4;
   c.save();c.translate(0,bob);
   if(Math.cos(e.facing)-Math.sin(e.facing)<-.05)c.scale(-1,1);
   if(move&&!options.reducedMotion){const stride=Math.sin(t*10+phase);c.scale(1+stride*.015,1-stride*.022);}
   const width=e.type==='siege'?55:e.type==='cavalry'?51:commander?47:36;const height=e.type==='siege'?44:e.type==='cavalry'?48:commander?59:45;
   if(attacking&&!options.reducedMotion){c.rotate(Math.sin(t*18+phase)*.025);c.translate(Math.sin(t*18)*1.5,0);}
   if(!this.atlas.draw(c,e.type,width,height))unit(c,e.type,e.team,t+phase,move,attacking,e.facing);
   c.restore();
   // Narrow pennants render beyond dense ranks and remain distinct from the supplied costume palette.
   if(commander){flag(c,-19,-14,e.team,t,true);c.font='bold 10px system-ui';c.textAlign='center';c.fillStyle='#efd990';c.fillText('★',0,-73);}
  }
  if(state.time-e.lastHitAt<.12){c.globalCompositeOperation='screen';ellipse(c,0,buildingEntity?-28:-24,buildingEntity?26:12,buildingEntity?20:15,'#ffe4b522');c.globalCompositeOperation='source-over';}
  if(selected||commander||damaged||options.showHealth||options.hoverId===e.id){
   const y=buildingEntity?e.type==='keep'?-133:e.type==='tower'?-107:-98:commander?-82:-58;
   this.bar(c,0,y,buildingEntity?57:commander?46:30,commander?4.3:3,e.hp/e.maxHp,e.team===team?'#85dba8':p.main);
   if(buildingEntity&&e.queue.length>0)this.bar(c,0,y+7,57,2.5,1-e.queue[0].remaining/e.queue[0].total,'#e7cf8a');
  }
  if(options.hoverId===e.id||selected&&buildingEntity){c.font='600 9px system-ui';c.textAlign='center';c.fillStyle='#f3efd8';c.shadowColor='#051520';c.shadowBlur=3;c.fillText(e.type.toUpperCase(),0,buildingEntity?26:20);c.shadowBlur=0;}
 }
 private bar(c:Ctx,x:number,y:number,w:number,h:number,value:number,color:string){c.fillStyle='#142831';c.fillRect(x-w/2-1,y-1,w+2,h+2);c.fillStyle='#081924';c.fillRect(x-w/2,y,w,h);c.fillStyle=color;c.fillRect(x-w/2,y,w*Math.max(0,Math.min(1,value)),h);c.fillStyle='#ffffff35';c.fillRect(x-w/2,y,w*Math.max(0,Math.min(1,value)),1);}
 private drawOrder(c:Ctx,e:Entity,z:number){
  const order=e.order;if(order.type==='move'||order.type==='attackMove'||order.type==='capture'){
   const start=this.worldToScreen(e.x,e.y),end=this.worldToScreen(order.x,order.y);c.save();c.strokeStyle=order.type==='attackMove'?'#ffa08370':'#bcf0de60';c.lineWidth=1;c.setLineDash([4,7]);c.beginPath();c.moveTo(start.x,start.y);for(const point of e.path){const p=this.worldToScreen(point.x,point.y);c.lineTo(p.x,p.y);}c.lineTo(end.x,end.y);c.stroke();c.setLineDash([]);diamond(c,end.x,end.y,9*z,5*z,'#ceffe620','#ceffe6aa',1);c.restore();
  }
  if(e.rally&&e.kind==='building'){const p=this.worldToScreen(e.rally.x,e.rally.y);c.save();c.translate(p.x,p.y);c.scale(z,z);flag(c,0,0,e.team,this.lastTime,true);ellipse(c,0,0,13,6,'#beeeeb20','#c8e9db80',1);c.restore();}
 }
 private drawEvent(c:Ctx,e:GameEvent,state:GameState,t:number,options:RenderOptions){
  const age=state.time-e.time;if(age<0||age>1.6)return;const from=this.worldToScreen(e.x,e.y),z=this.camera.zoom,p=palette(e.team),motion=options.reducedMotion;
  if(e.type==='projectile'&&e.targetX!==undefined&&e.targetY!==undefined){
   const to=this.worldToScreen(e.targetX,e.targetY);const duration=e.subtype==='siege'?.6:.26;if(age>duration)return;const f=age/duration,x=from.x+(to.x-from.x)*f,y=from.y+(to.y-from.y)*f-Math.sin(f*Math.PI)*(e.subtype==='siege'?36:12)*z;
   c.save();c.translate(x,y-18*z);c.rotate(Math.atan2(to.y-from.y,to.x-from.x));if(e.subtype==='support'||e.subtype==='engineer'){ellipse(c,0,0,5*z,3*z,'#b7efff');line(c,[-13*z,0,-3*z,0],'#a9e7ffaa',3*z);}else if(e.subtype==='siege'){ellipse(c,0,0,4*z,4*z,'#c7ad74');line(c,[-10*z,0,-4*z,0],'#ffc77477',3*z);}else{line(c,[-10*z,0,4*z,0],'#f8e3ab',1.4*z);poly(c,[4*z,0,-1*z,-2*z,-1*z,2*z],'#f1f5da');}c.restore();return;
  }
  c.save();c.translate(from.x,from.y);c.scale(z,z);
  if(e.type==='hit'||e.type==='attack'){
   if(age>.24){c.restore();return;}c.globalAlpha=1-age/.24;
   if(e.type==='hit'){
    for(let i=0;i<(options.quality==='low'?3:6);i++){const a=hash(e.id,i)*TAU,r=5+age*38;line(c,[Math.cos(a)*r,-20+Math.sin(a)*r*.7,Math.cos(a)*(r+4),-20+Math.sin(a)*(r+4)*.7],i%2?'#f6d185':'#fff4c7',1.2);}
   }else if(e.subtype!=='archer'&&e.subtype!=='siege'&&e.subtype!=='support'){
    c.beginPath();c.ellipse(2,-21,19,11,-.4,.1,2.1);c.strokeStyle='#fff3c1';c.lineWidth=2;c.stroke();
   }
  }else if(e.type==='death'){
   if(motion){c.restore();return;}c.globalAlpha=Math.max(0,1-age/1.3);ellipse(c,0,0,13+age*10,5+age*3,'#30352c55');for(let i=0;i<7;i++){const a=hash(e.id,i)*TAU,r=age*20;ellipse(c,Math.cos(a)*r,Math.sin(a)*r*.4-age*11,2+age*3,2+age*2,'#d6c7a333');}
  }else if(e.type==='ability'||e.type==='capture'||e.type==='heal'||e.type==='research'||e.type==='spawn'){
   const duration=e.type==='ability'?1.2:1;if(age>duration){c.restore();return;}const f=age/duration,r=motion?24:12+f*(e.type==='ability'?80:33);c.globalAlpha=1-f;
   const color=e.type==='heal'?'#b4e4a5':e.type==='capture'?'#f2d68e':p.main;ellipse(c,0,0,r,r*.5,'#e6edc800',color,e.type==='ability'?2:1.3);
   if(!motion)for(let i=0;i<8;i++){const a=i*TAU/8;ellipse(c,Math.cos(a)*r,-f*35+Math.sin(a)*r*.45,1.5,2.5,color);}
   if(e.type==='ability'){c.font='700 10px system-ui';c.textAlign='center';c.fillStyle='#fff0c1';c.fillText((e.subtype??'ABILITY').toUpperCase(),0,-52-f*15);}
  }else if(e.type==='build'){if(age<1){c.globalAlpha=1-age;ellipse(c,0,0,22+age*30,11+age*15,'#f9eab500','#e7d594',2);}}
  c.restore();
 }
 private drawFog(c:Ctx,state:GameState,options:RenderOptions){
  if(options.reveal)return;const map=state.map,team=options.team??0;const visible=state.fog.visible[team],explored=state.fog.explored[team];if(!visible||!explored)return;
  let sum=0;for(let i=0;i<visible.length;i++)sum=(sum+visible[i]*(i+7)+explored[i]*(i+13))|0;const stamp=`${map.width},${map.height},${team},${state.lastFogTick},${sum}`;
  if(stamp!==this.fogStamp){this.fogCanvas.width=map.width;this.fogCanvas.height=map.height;const fc=this.fogCanvas.getContext('2d')!,data=fc.createImageData(map.width,map.height);
   for(let i=0;i<visible.length;i++){data.data[i*4]=10;data.data[i*4+1]=23;data.data[i*4+2]=32;data.data[i*4+3]=visible[i]?0:explored[i]?156:250;}fc.putImageData(data,0,0);this.fogStamp=stamp;
  }
  const o=this.origin(),z=this.camera.zoom;c.save();c.setTransform(this.dpr*z*TILE_W/2,this.dpr*z*TILE_H/2,-this.dpr*z*TILE_W/2,this.dpr*z*TILE_H/2,o.x*this.dpr,o.y*this.dpr);c.imageSmoothingEnabled=true;c.drawImage(this.fogCanvas,0,0,map.width,map.height);c.restore();
 }
 private drawPlacement(c:Ctx,p:{type:string;x:number;y:number;valid:boolean;size?:number},t:number){
  const point=this.worldToScreen(p.x,p.y),color=p.valid?'#a2edbb':'#ff9c80',r=(p.size??2)*TILE_W/2,z=this.camera.zoom;c.save();c.translate(point.x,point.y);c.scale(z,z);diamond(c,0,0,r,r/2,p.valid?'#a2edbb22':'#ff957422',color,1.5);c.globalAlpha=.6;building(c,p.type,0,t);c.globalAlpha=1;c.font='700 10px system-ui';c.textAlign='center';c.fillStyle=color;c.shadowColor='#132630';c.shadowBlur=4;c.fillText(p.valid?'PLACE STRUCTURE':'CANNOT BUILD HERE',0,25);c.restore();
 }
 renderMinimap(canvas:HTMLCanvasElement,state:GameState){renderMinimap(canvas,state,{camera:this.camera,viewport:{width:this.width,height:this.height},team:this.lastOptions.team??0,reveal:this.lastOptions.reveal});}
}

export interface MinimapOptions {team?:number;reveal?:boolean;camera?:{x:number;y:number;zoom:number};viewport?:{width:number;height:number};}
export function renderMinimap(canvas:HTMLCanvasElement,state:GameState,options:MinimapOptions={}){
 const c=canvas.getContext('2d');if(!c)return;const w=canvas.width,h=canvas.height,map=state.map,team=options.team??0,sx=w/map.width,sy=h/map.height;
 const colors=terrainColors[map.biome]??terrainColors.grasslands;c.clearRect(0,0,w,h);c.fillStyle='#122b31';c.fillRect(0,0,w,h);
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){const index=y*map.width+x,explored=options.reveal||state.fog.explored[team]?.[index],visible=options.reveal||state.fog.visible[team]?.[index];
  c.fillStyle=explored?(colors[map.tiles[index]]??colors.grass)[0]:'#142932';c.globalAlpha=visible?1:explored?.42:1;c.fillRect(x*sx,y*sy,Math.ceil(sx),Math.ceil(sy));
 }c.globalAlpha=1;
 for(const n of map.nodes){const index=Math.floor(n.y)*map.width+Math.floor(n.x);if(!options.reveal&&!state.fog.explored[team]?.[index])continue;const x=n.x*sx,y=n.y*sy,owner=options.reveal||state.fog.visible[team]?.[index]?n.owner:null;c.fillStyle=n.kind==='relic'?'#fff0b0':owner===null?'#d8bc7e':palette(owner).main;if(n.kind==='relic')diamond(c,x,y,3.3,3.3,'#ffecac','#5b562a',.7);else{c.fillRect(x-1.8,y-1.8,3.6,3.6);}}
 for(const e of state.entities){if(e.hp<=0||e.respawnAt!==null)continue;const index=Math.floor(e.y)*map.width+Math.floor(e.x);if(e.team!==team&&!options.reveal&&!state.fog.visible[team]?.[index])continue;const p=palette(e.team);c.fillStyle=p.main;const x=e.x*sx,y=e.y*sy;if(e.kind==='building'){c.fillRect(x-2.5,y-2.5,5,5);c.strokeStyle=p.light;c.lineWidth=.7;c.strokeRect(x-2.5,y-2.5,5,5);}else if(e.kind==='commander')diamond(c,x,y,3.2,3.2,p.light,p.dark,.8);else{ellipse(c,x,y,1.5,1.5,p.main);}}
 for(const event of state.events){const age=state.time-event.time;if(age>1.4||age<0||!['attack','alert'].includes(event.type))continue;const index=Math.floor(event.y)*map.width+Math.floor(event.x);if(event.team!==team&&!options.reveal&&!state.fog.visible[team]?.[index])continue;c.globalAlpha=(1-age/1.4)*.7;ellipse(c,event.x*sx,event.y*sy,4+age*5,4+age*5,'#ff9d7800','#ffc093',1);}c.globalAlpha=1;
 if(options.camera&&options.viewport){const cam=options.camera,v=options.viewport;const dx=v.width/(TILE_W*cam.zoom)/2,dy=v.height/(TILE_H*cam.zoom)/2;const corners=[{x:cam.x-dx-dy,y:cam.y+dx-dy},{x:cam.x+dx-dy,y:cam.y-dx-dy},{x:cam.x+dx+dy,y:cam.y-dx+dy},{x:cam.x-dx+dy,y:cam.y+dx+dy}];c.strokeStyle='#f3f0d4';c.lineWidth=1;c.beginPath();corners.forEach((p,i)=>{if(i===0)c.moveTo(p.x*sx,p.y*sy);else c.lineTo(p.x*sx,p.y*sy);});c.closePath();c.stroke();}
}
