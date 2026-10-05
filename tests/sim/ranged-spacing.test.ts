import {describe,it,expect} from 'vitest';
import {createGame,spawnEntity,issueCommand,stepGame,updateFog,restoreGame,serializeGame} from '../../src/sim';
import type {GameState,Entity} from '../../src/sim';

// Explicit combat fixtures isolate movement contracts; these are not earned games.
function field() {
 const s=createGame({seed:'SPACING-CONTRACT',mapSize:'medium',aiPlayers:2,faction:'wildborn',commander:'ranger',difficulty:'normal',scriptedVictory:true});
 s.players.forEach(p=>p.ai=false);s.map.tiles.fill('grass');s.navigationVersion++;
 s.entities=s.entities.filter(e=>e.kind==='building');s.entities.forEach(e=>{e.damage=0;e.range=0;});
 return s;
}
function duel(kind:'unit'|'building'='unit',type:'swordsman'|'siege'|'barracks'='swordsman'){
 const s=field(),archer=spawnEntity(s,0,'unit','archer',24,22),enemy=spawnEntity(s,2,kind,type,26,22);
 enemy.hp=enemy.maxHp=10000;enemy.damage=0;enemy.order={type:'hold'};
 updateFog(s);issueCommand(s,{type:'attack',team:0,entityIds:[archer.id],targetId:enemy.id});return{s,archer,enemy};
}
const spacing=(s:GameState,enabled=true)=>issueCommand(s,{type:'rangedSpacing',team:0,enabled});
const pos=(e:Entity)=>({x:e.x,y:e.y});
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);

describe('shared ranged spacing with manual order priority',()=>{
 it('changes no purse, price or combat stats, and applies to future ranged recruits',()=>{
  const {s,archer}=duel();const funds=pos({x:s.players[0].gold,y:s.players[0].wood} as Entity);
  const stats=({hp,maxHp,damage,armor,range,speed,vision,attackPeriod}:Entity)=>({hp,maxHp,damage,armor,range,speed,vision,attackPeriod});
  const before=stats(archer);expect(spacing(s).ok).toBe(true);expect(stats(archer)).toEqual(before);
  expect({x:s.players[0].gold,y:s.players[0].wood}).toEqual(funds);
  const recruit=spawnEntity(s,0,'unit','archer',24,24);issueCommand(s,{type:'attackMove',team:0,entityIds:[recruit.id],x:30,y:24});
  stepGame(s,1);expect(recruit.skirmishAnchor).toBeDefined();
 });
 it('gives player and AI the same counter outcome without enabling strategic AI',()=>{
  const fight=(mode:'manual'|'player'|'ai')=>{
   const s=field();if(mode==='player')spacing(s);if(mode==='ai'){s.players[0].ai=true;s.players[0].aiNextThink=1e9;}
   const ours:Entity[]=[],theirs:Entity[]=[];
   for(let i=0;i<15;i++)ours.push(spawnEntity(s,0,'unit','archer',20.5,27.5+(i%9-4)*.62));
   for(let i=0;i<10;i++)theirs.push(spawnEntity(s,2,'unit','swordsman',30.5,27.5+(i%9-4)*.62));
   issueCommand(s,{type:'attackMove',team:0,entityIds:ours.map(e=>e.id),x:31,y:27.5});issueCommand(s,{type:'attackMove',team:2,entityIds:theirs.map(e=>e.id),x:20.5,y:27.5});
   for(let i=0;i<900&&ours.some(e=>e.hp>0)&&theirs.some(e=>e.hp>0);i++)stepGame(s,.1);
   return{time:s.time,ours:ours.filter(e=>e.hp>0).map(e=>({id:e.id,hp:e.hp,...pos(e)})),theirs:theirs.filter(e=>e.hp>0).map(e=>({id:e.id,hp:e.hp,...pos(e)})),damage:s.players.map(p=>p.stats.damageDealt)};
  };
  const manual=fight('manual'),player=fight('player'),ai=fight('ai');
  expect(manual.ours).toHaveLength(0);expect(player.ours.length).toBeGreaterThan(0);expect(player.theirs).toHaveLength(0);expect(player).toEqual(ai);
 });
 for(const order of ['move','hold'] as const)it(`${order} overrides automatic spacing immediately`,()=>{
  const {s,archer}=duel();spacing(s);stepGame(s,1);expect(archer.skirmishAnchor).toBeDefined();
  issueCommand(s,order==='move'?{type:order,team:0,entityIds:[archer.id],x:34,y:22}:{type:order,team:0,entityIds:[archer.id]});
  expect(archer.skirmishAnchor).toBeUndefined();const copy=restoreGame(serializeGame(s));spacing(copy,false);
  for(let i=0;i<15;i++){stepGame(s,.1);stepGame(copy,.1);expect(pos(archer)).toEqual(pos(copy.entities.find(e=>e.id===archer.id)!));expect(archer.skirmishAnchor).toBeUndefined();}
 });
 it('never fights direct commander steering or turns off its abilities',()=>{
  const s=field(),hero=spawnEntity(s,0,'commander','ranger',24,22),enemy=spawnEntity(s,2,'unit','swordsman',26,22);
  enemy.damage=0;enemy.hp=enemy.maxHp=10000;enemy.order={type:'hold'};spacing(s);
  const copy=restoreGame(serializeGame(s));spacing(copy,false);
  for(let i=0;i<12;i++)for(const game of [s,copy]){issueCommand(game,{type:'steer',team:0,dx:0,dy:1});stepGame(game,.1);}
  expect(pos(hero)).toEqual(pos(copy.entities.find(e=>e.id===hero.id)!));expect(hero.skirmishAnchor).toBeUndefined();
  expect(issueCommand(s,{type:'ability',team:0,ability:'trap',x:enemy.x,y:enemy.y}).ok).toBe(true);expect(enemy.hp).toBeLessThan(10000);
 });
 it('stops a retreat when disabled, keeping the same attack order',()=>{
  const {s,archer}=duel();spacing(s);stepGame(s,1);expect(archer.skirmishAnchor).toBeDefined();const before=pos(archer),order={...archer.order};
  expect(spacing(s,false).ok).toBe(true);expect(archer.order).toEqual(order);expect(archer.skirmishAnchor).toBeUndefined();stepGame(s,.3);expect(pos(archer)).toEqual(before);
 });
 it('keeps repeated retreats and obstacle detours within one ordinary ranged sight radius of contact',()=>{
  const {s,archer,enemy}=duel();spacing(s);for(let y=10;y<=33;y++)s.map.tiles[y*s.map.width+20]='rock';s.navigationVersion++;
  let maximum=0,anchor:{x:number;y:number}|undefined;
  for(let i=0;i<600;i++){
   enemy.x=archer.x+2;enemy.y=archer.y;stepGame(s,.1);anchor??=archer.skirmishAnchor;
   if(anchor)maximum=Math.max(maximum,distance(archer,anchor));
   expect(s.map.tiles[Math.floor(archer.y)*s.map.width+Math.floor(archer.x)]).toBe('grass');expect(archer.x).toBeGreaterThan(1);expect(archer.y).toBeGreaterThan(1);
  }
  expect(anchor).toBeDefined();expect(maximum).toBeLessThanOrEqual(9.001);expect(archer.order.type).toBe('attack');expect(enemy.hp).toBeLessThan(10000);
 });
 for(const order of ['idle','capture'] as const)it(`preserves the existing ${order} objective leash`,()=>{
  const {s,archer,enemy}=duel();spacing(s);
  if(order==='idle'){archer.order={type:'idle'};archer.guardAnchor=pos(archer);}
  else{const node=s.map.nodes.find(n=>n.kind==='gold')!;node.x=24;node.y=22;node.owner=0;issueCommand(s,{type:'capture',team:0,entityIds:[archer.id],nodeId:node.id});}
  const origin=pos(archer);let maximum=0;
  for(let i=0;i<300;i++){enemy.x=archer.x+2;enemy.y=archer.y;stepGame(s,.1);maximum=Math.max(maximum,distance(archer,origin));}
  expect(maximum).toBeLessThanOrEqual(order==='idle'?2.01:6.01);expect(archer.order.type).toBe(order);
 });
 for(const type of ['barracks','siege'] as const)it(`does not retreat from a ${type} target`,()=>{
  const {s,archer,enemy}=duel(type==='barracks'?'building':'unit',type);const copy=restoreGame(serializeGame(s));spacing(s);
  for(let i=0;i<80;i++){stepGame(s,.1);stepGame(copy,.1);expect(pos(archer)).toEqual(pos(copy.entities.find(e=>e.id===archer.id)!));expect(archer.skirmishAnchor).toBeUndefined();}
  expect(enemy.hp).toBeLessThan(10000);
 });
 it('round-trips the stance, contact anchor and paused toggle; rejects malformed values',()=>{
  const {s,archer}=duel();spacing(s);stepGame(s,1);const copy=restoreGame(serializeGame(s));expect(copy.players[0].rangedSpacing).toBe(true);expect(copy.entities.find(e=>e.id===archer.id)!.skirmishAnchor).toEqual(archer.skirmishAnchor);
  stepGame(s,1);stepGame(copy,1);expect(serializeGame(copy)).toBe(serializeGame(s));
  issueCommand(s,{type:'pause',team:0,paused:true});expect(spacing(s,false)).toEqual({ok:true,queued:true});const queued=restoreGame(serializeGame(s));expect(queued.players[0].rangedSpacing).toBe(true);issueCommand(queued,{type:'pause',team:0,paused:false});expect(queued.players[0].rangedSpacing).toBe(false);
  const old=createGame({seed:'LEGACY-SPACING-UNTOUCHED'});const restored=restoreGame(serializeGame(old));expect(restored.players[0].rangedSpacing).toBeUndefined();expect(serializeGame(restored)).toBe(serializeGame(old));
  const malformed=JSON.parse(serializeGame(s));malformed.players[0].rangedSpacing='yes';expect(()=>restoreGame(malformed)).toThrow(/ranged stance/);
  const badAnchor=JSON.parse(serializeGame(s));badAnchor.entities.find((e:Entity)=>e.id===archer.id).skirmishAnchor={x:9999,y:1,targetId:'invalid'};expect(()=>restoreGame(badAnchor)).toThrow(/skirmish anchor/);
  expect(issueCommand(s,{type:'rangedSpacing',team:0,enabled:'yes'} as any).ok).toBe(false);
 });
});
