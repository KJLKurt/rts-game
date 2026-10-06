import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validDirectionalData,type DirectionalData} from '../../src/render/DirectionalAtlas';
import {VISUAL_THEMES} from '../../src/render/visualThemes';
const root='public/assets/render/themes/mythic-toon/';
const data=JSON.parse(readFileSync(root+'swordsman-directional.json','utf8')) as DirectionalData;
const headings=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
describe('complete Mythic Swordsman directional art integration',()=>{
 it('contains one owned idle, four walk and four attack phases for all16 headings',()=>{
  expect(validDirectionalData(data)).toBe(true);expect(Object.keys(data.actors)).toEqual(['swordsman']);
  const actor=data.actors.swordsman,ids=actor.directions.flatMap(d=>[d.idle,...d.walk,...d.attack]);
  expect(new Set(ids).size).toBe(144);expect(Object.keys(data.frames).sort()).toEqual(ids.sort());
  for(const [index,heading] of headings.entries()){
   const clip=actor.directions[index];expect(clip.idle).toBe(`swordsman-${heading}-idle`);
   expect(clip.walk).toEqual([0,1,2,3].map(phase=>`swordsman-${heading}-walk-${phase}`));
   expect(clip.attack).toEqual([0,1,2,3].map(phase=>`swordsman-${heading}-attack-${phase}`));
  }
  expect(actor.impactFrame).toBe(2);expect(actor.attackFrameMs).toEqual([100,100,100,250]);
 });
 it('loads independently within its20MiB decoded texture budget while preserving the accepted Ranger bytes',()=>{
  expect(data.width*data.height*4).toBeLessThanOrEqual(20*1024*1024);
  const sha=(name:string)=>createHash('sha256').update(readFileSync(root+name)).digest('hex');
  expect(sha('ranger-directional.png')).toBe('da4153d26107b3edf37aff253dc0001e35d7c887f68a3e2384e29e70a43f1703');
  expect(sha('ranger-directional.json')).toBe('b788699b98e0d4b9cc381e63697cec2add9029dc9108d99acda75a50b7eed1b9');
  expect(VISUAL_THEMES.mythic.directionalAtlas).toContain('ranger-directional.json');
  expect(VISUAL_THEMES.mythic.additionalDirectionalAtlases).toEqual(['assets/render/themes/mythic-toon/swordsman-directional.json']);
 });
 it('keeps every crop disjoint so one phase cannot overwrite another actor pose',()=>{
  const frames=Object.values(data.frames);
  for(let i=0;i<frames.length;i++)for(const b of frames.slice(i+1)){
   const a=frames[i];expect(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y).toBe(true);
  }
 });
});
