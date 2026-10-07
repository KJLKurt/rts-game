import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DirectionalAtlas,validDirectionalData,type DirectionalData} from '../../src/render/DirectionalAtlas';
import {VISUAL_THEMES} from '../../src/render/visualThemes';
const root='public/assets/render/themes/mythic-toon/';
const data=JSON.parse(readFileSync(root+'spearman-directional.json','utf8')) as DirectionalData;
const heads=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
describe('complete Mythic Spearman owned directional pack',()=>{
 it('owns exactly144 valid frames across16 headings and all idle/walk/attack phases',()=>{
  expect(validDirectionalData(data)).toBe(true);expect(Object.keys(data.actors)).toEqual(['spearman']);
  const actor=data.actors.spearman,ids=actor.directions.flatMap(c=>[c.idle,...c.walk,...c.attack]);
  expect(new Set(ids).size).toBe(144);expect(Object.keys(data.frames).sort()).toEqual(ids.sort());
  for(const [i,h] of heads.entries()){
   expect(actor.directions[i]).toEqual({idle:`spearman-${h}-idle`,walk:[0,1,2,3].map(n=>`spearman-${h}-walk-${n}`),attack:[0,1,2,3].map(n=>`spearman-${h}-attack-${n}`)});
  }
 });
 it('fits its20MiB cap and loads independently without changing the three accepted actor assets',()=>{
  expect(data.width*data.height*4).toBeLessThanOrEqual(20*1024*1024);
  const hashes={
   'ranger-directional.png':'da4153d26107b3edf37aff253dc0001e35d7c887f68a3e2384e29e70a43f1703',
   'ranger-directional.json':'b788699b98e0d4b9cc381e63697cec2add9029dc9108d99acda75a50b7eed1b9',
   'swordsman-directional.png':'62a82d9fbaf252bc406e1fb49938ca997ce625182e577161a2539c62ba33313e',
   'swordsman-directional.json':'4a765af2334e245df7e15bd6f67566754d34dfa5cb8d6678c3651769dcda8fb6',
   'archer-directional.png':'c797395fddc20d8b20707373ef385da2075e0cd30317b7e27f5043738c198c09',
   'archer-directional.json':'4b9adb5e5c4d36c568912183b4bf2b51172afa038f1e716395ab5b8ebea8e3f3',
  };
  for(const [name,sha] of Object.entries(hashes))expect(createHash('sha256').update(readFileSync(root+name)).digest('hex')).toBe(sha);
  expect(VISUAL_THEMES.mythic.additionalDirectionalAtlases).toContain('assets/render/themes/mythic-toon/spearman-directional.json');
 });
 it('does not overlap any selected source crop in the packed image',()=>{
  const frames=Object.values(data.frames);
  for(const [i,a] of frames.entries())for(const b of frames.slice(i+1))
   expect(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y).toBe(true);
 });
 it('uses real event melee impact timing, travel phase and heading idle for reduced motion without mutating metadata',()=>{
  const atlas=new DirectionalAtlas();atlas.data=data;atlas.image={} as HTMLImageElement;
  const before=JSON.stringify(data),idle={attackAge:Infinity,anticipation:0,moving:false,travel:0};
  for(const [i,h] of heads.entries()){
   const a=i*Math.PI/8-Math.PI/2,x=Math.cos(a),y=Math.sin(a),f=Math.atan2((2*y-x)/2,(x+2*y)/2);
   expect(atlas.frame('spearman',f,{...idle,anticipation:.25})).toBe(`spearman-${h}-attack-0`);
   expect(atlas.frame('spearman',f,{...idle,anticipation:.75})).toBe(`spearman-${h}-attack-1`);
   expect(atlas.frame('spearman',f,{...idle,attackAge:0})).toBe(`spearman-${h}-attack-2`);
   expect(atlas.frame('spearman',f,{...idle,attackAge:.101})).toBe(`spearman-${h}-attack-3`);
   expect(atlas.frame('spearman',f,{...idle,attackAge:.351})).toBe(`spearman-${h}-idle`);
   for(let n=0;n<4;n++)expect(atlas.frame('spearman',f,{...idle,moving:true,travel:(n+.1)*2.3*.130})).toBe(`spearman-${h}-walk-${n}`);
   expect(atlas.frame('spearman',f,{...idle,moving:true,travel:4,attackAge:0,anticipation:1},true)).toBe(`spearman-${h}-idle`);
  }
  expect(JSON.stringify(data)).toBe(before);
 });
});
