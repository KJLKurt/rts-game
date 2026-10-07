import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DirectionalAtlas,validDirectionalData,type DirectionalData} from '../../src/render/DirectionalAtlas';
import {VISUAL_THEMES} from '../../src/render/visualThemes';
const root='public/assets/render/themes/mythic-toon/';
const data=JSON.parse(readFileSync(root+'archer-directional.json','utf8')) as DirectionalData;
const heads=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
describe('complete Mythic Archer owned directional pack',()=>{
 it('owns exactly144 valid frames across16 headings and all idle/walk/attack phases',()=>{
  expect(validDirectionalData(data)).toBe(true);expect(Object.keys(data.actors)).toEqual(['archer']);
  const actor=data.actors.archer,ids=actor.directions.flatMap(c=>[c.idle,...c.walk,...c.attack]);
  expect(new Set(ids).size).toBe(144);expect(Object.keys(data.frames).sort()).toEqual(ids.sort());
  for(const [i,h] of heads.entries()){
   expect(actor.directions[i]).toEqual({idle:`archer-${h}-idle`,walk:[0,1,2,3].map(n=>`archer-${h}-walk-${n}`),attack:[0,1,2,3].map(n=>`archer-${h}-attack-${n}`)});
  }
 });
 it('fits its20MiB cap and loads independently without changing either accepted actor asset',()=>{
  expect(data.width*data.height*4).toBeLessThanOrEqual(20*1024*1024);
  const hashes={
   'ranger-directional.png':'da4153d26107b3edf37aff253dc0001e35d7c887f68a3e2384e29e70a43f1703',
   'ranger-directional.json':'b788699b98e0d4b9cc381e63697cec2add9029dc9108d99acda75a50b7eed1b9',
   'swordsman-directional.png':'62a82d9fbaf252bc406e1fb49938ca997ce625182e577161a2539c62ba33313e',
   'swordsman-directional.json':'4a765af2334e245df7e15bd6f67566754d34dfa5cb8d6678c3651769dcda8fb6',
  };
  for(const [name,sha] of Object.entries(hashes))expect(createHash('sha256').update(readFileSync(root+name)).digest('hex')).toBe(sha);
  expect(VISUAL_THEMES.mythic.additionalDirectionalAtlases).toContain('assets/render/themes/mythic-toon/archer-directional.json');
 });
 it('does not overlap any selected source crop in the packed image',()=>{
  const frames=Object.values(data.frames);
  for(const [i,a] of frames.entries())for(const b of frames.slice(i+1))
   expect(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y).toBe(true);
 });
 it('uses real event release timing, travel phase and heading idle for reduced motion without mutating metadata',()=>{
  const atlas=new DirectionalAtlas();atlas.data=data;atlas.image={} as HTMLImageElement;
  const before=JSON.stringify(data),idle={attackAge:Infinity,anticipation:0,moving:false,travel:0};
  for(const [i,h] of heads.entries()){
   const a=i*Math.PI/8-Math.PI/2,x=Math.cos(a),y=Math.sin(a),f=Math.atan2((2*y-x)/2,(x+2*y)/2);
   expect(atlas.frame('archer',f,{...idle,anticipation:.25})).toBe(`archer-${h}-attack-0`);
   expect(atlas.frame('archer',f,{...idle,anticipation:.75})).toBe(`archer-${h}-attack-1`);
   expect(atlas.frame('archer',f,{...idle,attackAge:0})).toBe(`archer-${h}-attack-2`);
   expect(atlas.frame('archer',f,{...idle,attackAge:.101})).toBe(`archer-${h}-attack-3`);
   expect(atlas.frame('archer',f,{...idle,attackAge:.351})).toBe(`archer-${h}-idle`);
   for(let n=0;n<4;n++)expect(atlas.frame('archer',f,{...idle,moving:true,travel:(n+.1)*2.3*.130})).toBe(`archer-${h}-walk-${n}`);
   expect(atlas.frame('archer',f,{...idle,moving:true,travel:4,attackAge:0,anticipation:1},true)).toBe(`archer-${h}-idle`);
  }
  expect(JSON.stringify(data)).toBe(before);
 });
});
