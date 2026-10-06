import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {DirectionalAtlas,facingDirection,validDirectionalData,type DirectionalData} from '../../src/render/DirectionalAtlas';
const source=JSON.parse(readFileSync('public/assets/render/themes/mythic-toon/ranger-directional.json','utf8')) as DirectionalData;
const facing=(i:number)=>{const a=i*Math.PI/8-Math.PI/2,x=Math.cos(a),y=Math.sin(a);return Math.atan2((2*y-x)/2,(x+2*y)/2);};
const idle={attackAge:Infinity,anticipation:0,moving:false,travel:0};
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
function atlas(){const a=new DirectionalAtlas();a.image={} as HTMLImageElement;a.data=structuredClone(source);return a;}
describe('authored directional Ranger locomotion and attacks',()=>{
 it('projects all sixteen real world facings into screen headings without mirrored aliases',()=>{
  for(let i=0;i<16;i++)expect(facingDirection(facing(i))).toBe(i);
  expect([0,Math.PI/2,Math.PI,-Math.PI/2].map(facingDirection)).toEqual([5,11,13,3]);
  expect(facingDirection(NaN)).toBe(0);
 });
 it('ships 144 unique valid frames with complete idle, walk and four-pose attack coverage',()=>{
  expect(validDirectionalData(source)).toBe(true);
  const actor=source.actors.ranger,ids=actor.directions.flatMap(d=>[d.idle,...d.walk,...d.attack]);
  expect(new Set(ids).size).toBe(144);expect(Object.keys(source.frames).sort()).toEqual(ids.sort());
  expect(actor.attackFrameMs).toEqual([100,100,100,250]);expect(actor.directions.every(d=>d.attack.length===4)).toBe(true);
  expect(source.width*source.height*4).toBeLessThanOrEqual(32*1024*1024);
 });
 it('walk phase follows travelled distance; stationary/reduced-motion/combat retain the actual heading',()=>{
  const a=atlas();
  for(let i=0;i<16;i++){
   const d=source.actors.ranger.directions[i];expect(a.frame('ranger',facing(i),idle)).toBe(d.idle);
   for(let phase=0;phase<4;phase++)expect(a.frame('ranger',facing(i),{...idle,moving:true,travel:(phase+.1)*2.3*.130})).toBe(d.walk[phase]);
   expect(a.frame('ranger',facing(i),{...idle,moving:true,travel:4},true)).toBe(d.idle);
   expect(a.frame('ranger',facing(i),{...idle,attackAge:.02,moving:true,travel:4})).toBe(d.attack[2]);
   expect(a.frame('ranger',facing(i),{...idle,anticipation:.6,moving:true,travel:4})).toBe(d.attack[1]);
  }
 expect(a.frame('swordsman',0,idle)).toBeUndefined();
 });
 it('release starts at the real hit age, recovers, and returns to the same heading without an invented first windup',()=>{
  const a=atlas();
  for(let i=0;i<16;i++){
   const d=source.actors.ranger.directions[i];
   for(const [attackAge,phase] of [[0,2],[.099,2],[.101,3],[.349,3]] as const)
    expect(a.frame('ranger',facing(i),{...idle,attackAge})).toBe(d.attack[phase]);
   expect(a.frame('ranger',facing(i),{...idle,attackAge:.351})).toBe(d.idle);
   expect(a.frame('ranger',facing(i),{...idle,anticipation:.25})).toBe(d.attack[0]);
   expect(a.frame('ranger',facing(i),{...idle,anticipation:.75})).toBe(d.attack[1]);
   expect(a.frame('ranger',facing(i),{...idle,attackAge:0,anticipation:1},true)).toBe(d.idle);
  }
 });
 it('retains actual-heading idle fallback when a legacy complete pack has no attacks',()=>{
  const a=atlas(),actor=a.data!.actors.ranger;actor.attackFrameMs=[];
  for(const d of actor.directions){for(const id of d.attack)delete a.data!.frames[id];d.attack=[];}
  expect(validDirectionalData(a.data!)).toBe(true);
  for(let i=0;i<16;i++)expect(a.frame('ranger',facing(i),{...idle,attackAge:.02})).toBe(actor.directions[i].idle);
 });
 it('uses measured body height and a registered ground root without stretching or shrinking for weapon bounds',()=>{
  const a=atlas(),drawImage=vi.fn(),c={drawImage} as unknown as CanvasRenderingContext2D;
  for(const id of Object.keys(source.frames)){
   const f=source.frames[id],scale=59/f.bodyHeight;
   expect(a.draw(c,'ranger',id,59)).toBe(true);
   expect(drawImage).toHaveBeenLastCalledWith(a.image,f.x,f.y,f.w,f.h,-f.groundPivot.x*scale,-f.groundPivot.y*scale,f.w*scale,f.h*scale);
  }
  expect(a.draw(c,'swordsman',source.actors.ranger.directions[0].idle)).toBe(false);
  expect(a.draw(c,'ranger','missing')).toBe(false);
 });
 it.each(['bounds','pivot','body','timing','coverage','actor','attack-timing','attack-coverage'])('rejects corrupt %s metadata before image loading',kind=>{
  const data=structuredClone(source),f=data.frames[data.actors.ranger.directions[0].idle];
  if(kind==='bounds')f.x=data.width;
  if(kind==='pivot')f.groundPivot.x=-1;
  if(kind==='body')f.bodyHeight=Infinity;
  if(kind==='timing')data.actors.ranger.walkFrameMs=NaN;
  if(kind==='coverage')data.actors.ranger.directions.pop();
  if(kind==='actor')f.actor='swordsman';
  if(kind==='attack-timing')data.actors.ranger.attackFrameMs[0]=NaN;
  if(kind==='attack-coverage')data.actors.ranger.directions[7].attack.pop();
  expect(validDirectionalData(data)).toBe(false);
 });
 it('failed image decode retains existing production pixels',async()=>{
  const a=atlas(),old=a.image,data=a.data;
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>source}));
  vi.stubGlobal('document',{baseURI:'http://localhost/rts-game/'});
  vi.stubGlobal('Image',class {src='';decode(){return Promise.reject(new Error('decode failed'));}});
  expect(await a.load('assets/render/themes/mythic-toon/ranger-directional.json')).toBe(false);
  expect(a.image).toBe(old);expect(a.data).toBe(data);
 });
});
