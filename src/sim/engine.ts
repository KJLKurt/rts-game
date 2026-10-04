import type {GameMap,GameState,GameSettings,GameCommand,CommandResult,Entity,Point,Player,PlayerStats,UnitId,BuildingId,TechId,GameEvent,CommanderId,ScriptAction} from './types';
import {DEFAULT_SETTINGS,UNITS,BUILDINGS,COMMANDERS,FACTIONS,TECHNOLOGIES,BIOMES,FIXED_STEP,TEAM_COLORS,TEAM_SYMBOLS} from './content';
import {generateMap,validateMap,hashSeed,distance,isWalkable,isBuildable,terrainAt,tileIndex,findPath} from './maps';
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const living=(e:Entity)=>e.hp>0;
const active=(e:Entity)=>e.hp>0&&e.buildProgress>=1;
const stats=():PlayerStats=>({unitsCreated:0,unitsLost:0,kills:0,buildingsCreated:0,buildingsDestroyed:0,goldCollected:0,woodCollected:0,captures:0,commanderDeaths:0,damageDealt:0,pauses:0});
function random(state:GameState){let x=state.rng;x^=x<<13;x^=x>>>17;x^=x<<5;state.rng=x>>>0;return state.rng/4294967296;}
function emit(s:GameState,event:Omit<GameEvent,'id'|'time'>){s.events.push({...event,id:s.nextEventId++,time:s.time});}
export function createGame(partial:Partial<GameSettings>={}):GameState{
 const settings:GameSettings={...DEFAULT_SETTINGS,...partial};
 settings.aiPlayers=clamp(Math.floor(settings.aiPlayers),1,5);settings.duration=clamp(settings.duration,4,90);settings.populationCap=clamp(settings.populationCap,12,200);
 if(!BIOMES[settings.biome]||!FACTIONS[settings.faction]||!COMMANDERS[settings.commander])throw new Error('Unknown biome, faction or commander.');
 const map:GameMap=settings.customMap?JSON.parse(JSON.stringify(settings.customMap)):generateMap(settings);
 map.validation=validateMap(map,settings.preset==='competitive');if(!map.validation.valid)throw new Error(`Invalid map: ${map.validation.errors.join(' ')}`);
 const state:GameState={version:1,settings,map,entities:[],players:[],time:0,tick:0,accumulator:0,winner:null,victoryReason:'',paused:false,pendingCommands:[],events:[],fog:{visible:[],explored:[]},nextId:1,nextEventId:1,rng:hashSeed(settings.seed+':simulation'),scoreTarget:Math.round(settings.duration*80),escalation:1,objectiveText:settings.mode==='conquest'?'Destroy every enemy Command Keep.':'Capture relics to earn victory points, or destroy enemy keeps.',triggers:[],commandLog:[],lastFogTick:-10,navigationVersion:0};
 const factions=['ironhold','wildborn','arcanists'] as const,commanders=['warlord','ranger','engineer'] as const;
 map.spawns.forEach((spawn,team)=>{
  const p:Player={team,name:team===0?'You':`Rival ${team}`,faction:team===0?settings.faction:factions[team%3],commander:team===0?settings.commander:commanders[team%3],color:TEAM_COLORS[team],symbol:TEAM_SYMBOLS[team],gold:settings.startingGold,wood:settings.startingWood,population:0,populationCap:12,maxPopulation:settings.populationCap,research:{},score:0,defeated:false,ai:team>0||settings.aiControlPlayer,personality:settings.aiPersonality,stats:stats(),aiNextThink:1+team*.2,aiPhase:'Establishing a foothold',lastKnownEnemies:[]};
  state.players.push(p);state.fog.visible.push(Array(map.width*map.height).fill(0));state.fog.explored.push(Array(map.width*map.height).fill(0));
  spawnEntity(state,team,'building','keep',spawn.x,spawn.y,true);
  const dir=spawn.x<map.width/2?1:-1;
  spawnEntity(state,team,'building','barracks',spawn.x,spawn.y+3,true);
  spawnEntity(state,team,'commander',p.commander,spawn.x+dir*3,spawn.y,true);
  ['swordsman','swordsman','spearman','archer'].forEach((id,i)=>spawnEntity(state,team,'unit',id as UnitId,spawn.x+dir*(3+(i%2)),spawn.y-1.7-Math.floor(i/2)*.9,true));
 });
 updatePopulation(state);updateFog(state);return state;
}
export function getCommander(state:GameState,team=0):Entity|undefined{return state.entities.find(e=>e.team===team&&e.kind==='commander');}
export function getPlayerStats(state:GameState,team=0){const p=state.players[team];return{...p.stats,gold:p.gold,wood:p.wood,population:p.population,populationCap:p.populationCap,score:p.score,research:{...p.research},time:state.time};}
export function getUnitCost(state:GameState,team:number,id:UnitId){const f=FACTIONS[state.players[team].faction];return{gold:Math.ceil(UNITS[id].cost.gold*f.cost),wood:Math.ceil(UNITS[id].cost.wood*f.cost)};}
function freePosition(s:GameState,x:number,y:number,radius=.3):Point{
 const free=(xx:number,yy:number)=>isWalkable(s.map,xx,yy)&&!s.entities.some(e=>e.kind==='building'&&living(e)&&distance(e,{x:xx,y:yy})<e.radius+radius);
 if(free(x,y))return{x,y};
 for(let r=.7;r<7;r+=.7)for(let n=0;n<16;n++){const a=n*Math.PI/8,xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r;if(free(xx,yy))return{x:xx,y:yy};}
 return{x:clamp(x,1,s.map.width-2),y:clamp(y,1,s.map.height-2)};
}
export function spawnEntity(s:GameState,team:number,kind:Entity['kind'],type:Entity['type'],x:number,y:number,complete=true):Entity{
 const p=s.players[team],f=FACTIONS[p.faction];let hp=100,damage=0,armor=0,range=0,speed=0,vision=6,period=1,radius=.3,buildTime=0;
 if(kind==='unit'){const d=UNITS[type as UnitId];hp=d.hp*f.health;damage=d.damage*f.damage;armor=d.armor;range=d.range;speed=d.speed*f.speed;vision=d.vision;period=d.cooldown;radius=type==='cavalry'?.42:type==='siege'?.48:.27;}
 if(kind==='commander'){const d=COMMANDERS[type as CommanderId];hp=d.hp*f.health;damage=d.damage*f.damage;armor=d.armor;range=d.range;speed=d.speed*f.speed;vision=d.vision;period=d.cooldown;radius=.42;}
 if(kind==='building'&&type!=='turret'){const d=BUILDINGS[type as BuildingId];hp=d.hp*f.buildingHealth;damage=d.damage??0;range=d.range??0;vision=d.vision;period=1.4;radius=d.size;buildTime=d.buildTime;armor=type==='keep'?8:3;}
 if(type==='turret'){hp=280;damage=22;range=6.3;vision=7;period=.8;radius=.45;}
 if(team===0){hp*=s.settings.modifiers?.playerHealth??1;damage*=s.settings.modifiers?.playerDamage??1;}
 const pos=kind==='building'?{x,y}:freePosition(s,x,y,radius);
 const e:Entity={id:`e${s.nextId++}`,team,kind,type,...pos,hp:complete?hp:hp*.12,maxHp:hp,damage,armor,range,speed,vision,attackCooldown:0,attackPeriod:period,radius,facing:0,order:{type:'idle'},path:[],pathTarget:null,pathTimer:0,targetId:null,buildProgress:complete?1:0,buildTime,queue:[],rally:null,abilityCooldowns:{},buffUntil:0,slowUntil:0,invulnerableUntil:0,respawnAt:null,lifetime:type==='turret'?30:null,lastHitAt:-100};
 s.entities.push(e);if(kind==='unit')p.stats.unitsCreated++;if(kind==='building'){p.stats.buildingsCreated++;s.navigationVersion++;}emit(s,{type:kind==='building'?'build':'spawn',x:e.x,y:e.y,team,entityId:e.id,subtype:type});return e;
}
function selected(s:GameState,c:{team:number;entityIds?:string[]}):Entity[]{return s.entities.filter(e=>e.team===c.team&&living(e)&&e.kind!=='building'&&(c.entityIds?c.entityIds.includes(e.id):e.kind==='commander'));}
function setOrder(e:Entity,order:Entity['order']){e.order=order;e.path=[];e.pathTarget=null;e.pathTimer=0;e.targetId=null;}
function affordable(p:Player,cost:{gold:number;wood:number}){return p.gold+1e-6>=cost.gold&&p.wood+1e-6>=cost.wood;}
function pay(p:Player,cost:{gold:number;wood:number}){p.gold-=cost.gold;p.wood-=cost.wood;}
export function canBuild(s:GameState,team:number,id:BuildingId,x:number,y:number):CommandResult{
 const d=BUILDINGS[id],p=s.players[team];if(!d||!p)return{ok:false,error:'Unknown building.'};if(id==='keep')return{ok:false,error:'Your Command Keep cannot be replaced.'};
 if(!Number.isFinite(x)||!Number.isFinite(y))return{ok:false,error:'Choose a valid location.'};
 for(let yy=y-d.size;yy<=y+d.size;yy+=.6)for(let xx=x-d.size;xx<=x+d.size;xx+=.6)if(!isBuildable(s.map,xx,yy))return{ok:false,error:'Build on clear, dry ground.'};
 if(s.entities.some(e=>e.kind==='building'&&living(e)&&distance(e,{x,y})<e.radius+d.size+.35))return{ok:false,error:'Too close to another building.'};
 if(s.map.nodes.some(n=>distance(n,{x,y})<d.size+1.4))return{ok:false,error:'Leave room around the resource point.'};
 if(!s.entities.some(e=>e.team===team&&active(e)&&(e.kind==='building'||e.kind==='commander')&&distance(e,{x,y})<9)&&!s.map.nodes.some(n=>n.owner===team&&distance(n,{x,y})<5))return{ok:false,error:'Build near your commander, base, or captured territory.'};
 for(const pre of d.prerequisites)if(!s.entities.some(e=>e.team===team&&e.type===pre&&active(e)))return{ok:false,error:`Requires ${BUILDINGS[pre].name}.`};
 if(!affordable(p,d.cost))return{ok:false,error:`Need ${d.cost.gold} gold and ${d.cost.wood} wood.`};
 return{ok:true};
}
export function issueCommand(s:GameState,c:GameCommand):CommandResult{
 if(s.winner!==null)return{ok:false,error:'The battle has ended.'};const p=s.players[c.team];if(!p||p.defeated)return{ok:false,error:'Player is not active.'};
 if(c.type==='pause'){
  if(s.settings.difficulty==='brutal'&&c.paused)return{ok:false,error:'Tactical pause is disabled on Brutal.'};
  if(s.settings.difficulty==='hard'&&c.paused&&!s.paused&&p.stats.pauses>=3)return{ok:false,error:'All three tactical pauses have been used.'};
  if(c.paused&&!s.paused)p.stats.pauses++;s.paused=c.paused;
  if(!s.paused){const pending=s.pendingCommands.splice(0);for(const order of pending){const result=issueCommand(s,order);if(!result.ok)emit(s,{type:'alert',x:0,y:0,team:order.team,text:result.error});}}
  return{ok:true};
 }
 if(s.paused){if(s.pendingCommands.length>=60)return{ok:false,error:'Tactical queue is full.'};s.pendingCommands.push(JSON.parse(JSON.stringify(c)));return{ok:true,queued:true};}
 const result=executeCommand(s,c);if(result.ok)s.commandLog.push({tick:s.tick,command:JSON.parse(JSON.stringify(c))});return result;
}
function executeCommand(s:GameState,c:Exclude<GameCommand,{type:'pause'}>):CommandResult{
 const p=s.players[c.team];
 if(c.type==='move'||c.type==='attackMove'){
  if(!Number.isFinite(c.x)||!Number.isFinite(c.y))return{ok:false,error:'Choose a valid destination.'};const units=selected(s,c);if(!units.length)return{ok:false,error:'Select troops first.'};
  const target=freePosition(s,clamp(c.x,1,s.map.width-2),clamp(c.y,1,s.map.height-2));
  units.forEach((e,i)=>{const a=i*2.39996,r=units.length>1?Math.sqrt(i)*.65:0;setOrder(e,{type:c.type,x:clamp(target.x+Math.cos(a)*r,1,s.map.width-2),y:clamp(target.y+Math.sin(a)*r,1,s.map.height-2)});});return{ok:true};
 }
 if(c.type==='attack'){const target=s.entities.find(e=>e.id===c.targetId&&living(e));if(!target||target.team===c.team)return{ok:false,error:'Choose an enemy target.'};if(!isVisible(s,c.team,target.x,target.y))return{ok:false,error:'Target is outside your vision.'};selected(s,c).forEach(e=>setOrder(e,{type:'attack',targetId:c.targetId}));return{ok:true};}
 if(c.type==='hold'){selected(s,c).forEach(e=>setOrder(e,{type:'hold'}));return{ok:true};}
 if(c.type==='capture'){const node=s.map.nodes.find(n=>n.id===c.nodeId);if(!node)return{ok:false,error:'No such resource point.'};selected(s,c).forEach(e=>setOrder(e,{type:'capture',x:node.x,y:node.y,nodeId:node.id}));return{ok:true};}
 if(c.type==='rally'){const b=s.entities.find(e=>e.id===c.buildingId&&e.team===c.team&&e.kind==='building');if(!b||!Number.isFinite(c.x)||!Number.isFinite(c.y))return{ok:false,error:'Select a friendly recruitment building.'};b.rally={x:c.x,y:c.y};return{ok:true};}
 if(c.type==='build'){const check=canBuild(s,c.team,c.building,c.x,c.y);if(!check.ok)return check;pay(p,BUILDINGS[c.building].cost);spawnEntity(s,c.team,'building',c.building,c.x,c.y,false);return{ok:true};}
 if(c.type==='recruit'){
  const d=UNITS[c.unit];if(!d)return{ok:false,error:'Unknown unit.'};const b=s.entities.filter(e=>e.team===c.team&&e.kind==='building'&&e.type!=='turret'&&active(e)&&BUILDINGS[e.type as BuildingId].recruits.includes(c.unit)&&(!c.buildingId||e.id===c.buildingId)).sort((a,b)=>a.queue.length-b.queue.length)[0];
  if(!b)return{ok:false,error:`Build a ${BUILDINGS[d.building].name} first.`};if(b.queue.length>=6)return{ok:false,error:'Recruitment queue is full.'};
  const cost=getUnitCost(s,c.team,c.unit);if(!affordable(p,cost))return{ok:false,error:`Need ${cost.gold} gold and ${cost.wood} wood.`};updatePopulation(s);if(p.population+d.population>p.populationCap)return{ok:false,error:'Population limit reached. Build a house.'};
  pay(p,cost);const total=d.trainTime*(p.research.logistics?.85:1);b.queue.push({type:'unit',id:c.unit,total,remaining:total});updatePopulation(s);return{ok:true};
 }
 if(c.type==='research'){
  const d=TECHNOLOGIES[c.technology];if(!d)return{ok:false,error:'Unknown technology.'};const level=p.research[c.technology]??0;if(level>=d.maxLevel)return{ok:false,error:'Research is already complete.'};
  if(s.entities.some(e=>e.team===c.team&&e.queue.some(q=>q.type==='research'&&q.id===c.technology)))return{ok:false,error:'Research is already in progress.'};
  const b=s.entities.find(e=>e.team===c.team&&e.type===d.building&&active(e)&&(!c.buildingId||e.id===c.buildingId));if(!b)return{ok:false,error:`Requires ${BUILDINGS[d.building].name}.`};if(b.queue.length>=6)return{ok:false,error:'Production queue is full.'};const cost={gold:d.cost.gold*(level+1),wood:d.cost.wood*(level+1)};if(!affordable(p,cost))return{ok:false,error:`Need ${cost.gold} gold and ${cost.wood} wood.`};pay(p,cost);b.queue.push({type:'research',id:d.id,total:d.time,remaining:d.time});return{ok:true};
 }
 if(c.type==='ability')return useAbility(s,c.team,c.ability,c.x,c.y);
 return{ok:false,error:'Unknown command.'};
}
export function isVisible(s:GameState,team:number,x:number,y:number){return !!s.fog.visible[team]?.[tileIndex(s.map,x,y)];}
function useAbility(s:GameState,team:number,id:string,x?:number,y?:number):CommandResult{
 const e=getCommander(s,team);if(!e||!living(e))return{ok:false,error:'Your commander is recovering.'};const def=COMMANDERS[e.type as CommanderId].abilities.find(a=>a.id===id);if(!def)return{ok:false,error:'Ability is not available.'};if((e.abilityCooldowns[id]??0)>0)return{ok:false,error:'Ability is recharging.'};
 const target={x:x??e.x+Math.cos(e.facing)*5,y:y??e.y+Math.sin(e.facing)*5};if(!Number.isFinite(target.x)||!Number.isFinite(target.y))return{ok:false,error:'Invalid ability target.'};
 e.abilityCooldowns[id]=def.cooldown*(s.players[team].research.veterancy?.8:1);
 if(id==='charge'||id==='dodge'){
  const d=distance(e,target),length=Math.min(id==='charge'?7:5,d),dx=d?(target.x-e.x)/d:Math.cos(e.facing),dy=d?(target.y-e.y)/d:Math.sin(e.facing);
  const start={x:e.x,y:e.y};for(let n=.3;n<=length;n+=.3){const px=start.x+dx*n,py=start.y+dy*n;if(!isWalkable(s.map,px,py)||s.entities.some(b=>b.kind==='building'&&living(b)&&distance(b,{x:px,y:py})<b.radius+e.radius))break;e.x=px;e.y=py;}
  setOrder(e,{type:'idle'});if(id==='dodge')e.invulnerableUntil=s.time+1.3;
  if(id==='charge')for(const enemy of s.entities)if(enemy.team!==team&&living(enemy)&&distance(enemy,e)<3){dealDamage(s,e,enemy,70);enemy.slowUntil=s.time+3;}
 }else if(id==='rally'||id==='repair'){
  for(const ally of s.entities)if(ally.team===team&&living(ally)&&distance(ally,e)<7){const heal=id==='repair'?(ally.kind==='building'?260:110):75;ally.hp=Math.min(ally.maxHp,ally.hp+heal);if(id==='rally')ally.buffUntil=s.time+8;emit(s,{type:'heal',x:ally.x,y:ally.y,team,value:heal});}
 }else if(id==='trap'){
  const d=distance(e,target);if(d>8){target.x=e.x+(target.x-e.x)*8/d;target.y=e.y+(target.y-e.y)*8/d;}
  for(const enemy of s.entities)if(enemy.team!==team&&living(enemy)&&distance(enemy,target)<3.6){dealDamage(s,e,enemy,75);enemy.slowUntil=s.time+6;}
 }else if(id==='turret'){
  const pos=freePosition(s,e.x+Math.cos(e.facing)*1.8,e.y+Math.sin(e.facing)*1.8,.5);spawnEntity(s,team,'building','turret',pos.x,pos.y,true);
 }
 emit(s,{type:'ability',x:id==='trap'?target.x:e.x,y:id==='trap'?target.y:e.y,team,entityId:e.id,subtype:id});return{ok:true};
}
export function combatDamage(s:GameState,attacker:Entity,target:Entity):number{
 const p=s.players[attacker.team],op=s.players[target.team];let amount=attacker.damage;
 if(attacker.kind==='unit'){amount*=UNITS[attacker.type as UnitId].counter[target.kind==='building'?'building':target.type as UnitId]??1;const tech=attacker.type==='archer'?'fletching':'steel';amount*=1+(p.research[tech]??0)*(tech==='fletching'?.12:.15);}
 if(target.kind==='building'&&attacker.type!=='siege')amount*=.65;
 if(attacker.buffUntil>s.time)amount*=1.35;
 if(attacker.kind==='unit'&&target.kind==='building')amount*=1+Math.max(0,s.escalation-1)*.45;
 return Math.max(2,amount-(target.armor+(op.research.armor??0)*2));
}
function dealDamage(s:GameState,source:Entity,target:Entity,amount:number){
 if(target.invulnerableUntil>s.time||target.hp<=0)return;const dealt=Math.min(target.hp,amount);target.hp=Math.max(0,target.hp-amount);target.lastHitAt=s.time;s.players[source.team].stats.damageDealt+=dealt;
 emit(s,{type:'hit',x:target.x,y:target.y,team:source.team,entityId:target.id,value:Math.round(dealt),subtype:source.type});
 if(target.hp<=0){const loser=s.players[target.team];if(target.kind==='building'){s.players[source.team].stats.buildingsDestroyed++;s.navigationVersion++;}else if(target.kind==='unit'){loser.stats.unitsLost++;s.players[source.team].stats.kills++;}else{loser.stats.commanderDeaths++;target.respawnAt=s.time+24;setOrder(target,{type:'idle'});}
  emit(s,{type:'death',x:target.x,y:target.y,team:target.team,entityId:target.id,subtype:target.type});
  if(target.type==='keep'){loser.defeated=true;for(const n of s.map.nodes)if(n.owner===target.team)n.owner=null;emit(s,{type:'alert',x:target.x,y:target.y,team:target.team,text:`${loser.name}'s Command Keep has fallen!`});}
 }
}
const navCache=new WeakMap<GameState,{version:number;blocked:Set<number>}>();
function blockers(s:GameState){const old=navCache.get(s);if(old&&old.version===s.navigationVersion)return old.blocked;const blocked=new Set<number>();for(const b of s.entities)if(b.kind==='building'&&living(b)){for(let y=Math.floor(b.y-b.radius);y<=Math.floor(b.y+b.radius);y++)for(let x=Math.floor(b.x-b.radius);x<=Math.floor(b.x+b.radius);x++)if(distance(b,{x:x+.5,y:y+.5})<b.radius+.25)blocked.add(y*s.map.width+x);}navCache.set(s,{version:s.navigationVersion,blocked});return blocked;}
function moveToward(s:GameState,e:Entity,goal:Point,dt:number){
 const dist=distance(e,goal);if(dist<.12){e.path=[];return;}
 e.pathTimer-=dt;
 if(!e.pathTarget||distance(e.pathTarget,goal)>1.5||(!e.path.length&&e.pathTimer<=0)){
  const blocked=blockers(s);let direct=true;const samples=Math.ceil(dist*2.5);for(let i=1;i<=samples;i++){const t=i/samples,x=e.x+(goal.x-e.x)*t,y=e.y+(goal.y-e.y)*t;if(!isWalkable(s.map,x,y)||blocked.has(tileIndex(s.map,x,y))){direct=false;break;}}
  e.path=direct?[{...goal}]:findPath(s.map,e,goal,blocked);
  if(e.path.length&&isWalkable(s.map,goal.x,goal.y)&&!blocked.has(tileIndex(s.map,goal.x,goal.y)))e.path[e.path.length-1]={...goal};
  e.pathTarget={...goal};e.pathTimer=e.path.length?1.2:3;
 }
 let next=e.path[0];if(!next)return;
 if(distance(e,next)<.23){e.path.shift();next=e.path[0]??goal;}
 const dx=next.x-e.x,dy=next.y-e.y,d=Math.hypot(dx,dy);if(d<.01)return;e.facing=Math.atan2(dy,dx);
 let speed=e.speed*BIOMES[s.map.biome].speed*(1+(s.players[e.team].research.logistics??0)*.15);const terrain=terrainAt(s.map,e.x,e.y);if(terrain==='forest')speed*=e.type==='cavalry'||e.type==='siege'?.6:.82;if(terrain==='marsh')speed*=.55;if(terrain==='road')speed*=1.12;if(e.slowUntil>s.time)speed*=.45;
 const amount=Math.min(speed*dt,d),nx=e.x+dx/d*amount,ny=e.y+dy/d*amount;
 if(isWalkable(s.map,nx,ny)&&!blockers(s).has(tileIndex(s.map,nx,ny))){e.x=nx;e.y=ny;}else{e.path=[];e.pathTimer=0;}
}
function attackRange(s:GameState,e:Entity){return e.range+(e.type==='archer'?(s.players[e.team].research.fletching??0):0);}
function updateEntities(s:GameState,dt:number){
 const alive=s.entities.filter(living);
 for(const e of s.entities){
  if(e.hp<=0){if(e.kind==='commander'&&e.respawnAt!==null&&e.respawnAt<=s.time&&!s.players[e.team].defeated){const spawn=s.map.spawns[e.team],pos=freePosition(s,spawn.x+3,spawn.y);e.x=pos.x;e.y=pos.y;e.hp=e.maxHp;e.respawnAt=null;e.invulnerableUntil=s.time+3;emit(s,{type:'spawn',x:e.x,y:e.y,team:e.team,entityId:e.id,subtype:e.type});}continue;}
  if(s.players[e.team].defeated)continue;
  for(const key of Object.keys(e.abilityCooldowns))e.abilityCooldowns[key]=Math.max(0,e.abilityCooldowns[key]-dt);
  if(e.lifetime!==null){e.lifetime-=dt;if(e.lifetime<=0){e.hp=0;s.navigationVersion++;continue;}}
  if(e.buildProgress<1){const before=e.buildProgress;e.buildProgress=Math.min(1,e.buildProgress+dt/e.buildTime);e.hp=Math.min(e.maxHp,e.hp+(e.buildProgress-before)*e.maxHp*.88);if(e.buildProgress===1)emit(s,{type:'build',x:e.x,y:e.y,team:e.team,entityId:e.id,subtype:'complete'});continue;}
  if(e.queue.length){const q=e.queue[0];q.remaining-=dt;if(q.remaining<=0){e.queue.shift();if(q.type==='unit'){const pos=freePosition(s,e.x+e.radius+1,e.y);const unit=spawnEntity(s,e.team,'unit',q.id as UnitId,pos.x,pos.y);const commander=getCommander(s,e.team);const goal=e.rally??(commander&&living(commander)?commander:null);if(goal)setOrder(unit,{type:'attackMove',x:goal.x,y:goal.y});}else{const id=q.id as TechId;s.players[e.team].research[id]=(s.players[e.team].research[id]??0)+1;if(id==='veterancy'){const commander=getCommander(s,e.team);if(commander){commander.maxHp*=1.25;commander.hp=Math.min(commander.maxHp,commander.hp+commander.maxHp*.2);}}emit(s,{type:'research',x:e.x,y:e.y,team:e.team,subtype:id,text:`${TECHNOLOGIES[id].name} complete`});}}}
  e.attackCooldown=Math.max(0,e.attackCooldown-dt);
  if(e.kind==='commander'&&s.time-e.lastHitAt>7)e.hp=Math.min(e.maxHp,e.hp+dt*3);
  if(e.type==='keep'&&s.time-e.lastHitAt>10)e.hp=Math.min(e.maxHp,e.hp+dt*8);
  if(e.type==='support'&&e.attackCooldown<=0){const ally=alive.filter(a=>a.team===e.team&&a.kind!=='building'&&a.hp<a.maxHp*.96&&distance(a,e)<5).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(ally){const heal=s.players[e.team].faction==='arcanists'?20:16;ally.hp=Math.min(ally.maxHp,ally.hp+heal);e.attackCooldown=1.5;emit(s,{type:'heal',x:ally.x,y:ally.y,team:e.team,value:heal});}}
  let target:Entity|undefined;
  const range=attackRange(s,e);
  if(e.order.type==='attack')target=alive.find(a=>a.id===(e.order as {targetId:string}).targetId&&a.hp>0&&isVisible(s,e.team,a.x,a.y));
  if(!target&&e.order.type!=='move'){
   const sight=e.kind==='building'?range:e.order.type==='hold'?range:e.order.type==='capture'?Math.min(e.vision,5):e.vision;
   let best=Infinity;for(const enemy of alive){if(enemy.team===e.team||enemy.hp<=0||s.players[enemy.team].defeated||!isVisible(s,e.team,enemy.x,enemy.y))continue;const d=distance(e,enemy)-enemy.radius;if(d>sight)continue;if(e.order.type==='capture'&&distance(enemy,e.order)>6.5)continue;const priority=d+(enemy.kind==='building'?3:0)+(e.type==='siege'&&enemy.kind!=='building'?3:0);if(priority<best){best=priority;target=enemy;}}
  }
  if(target&&e.damage>0){e.targetId=target.id;const d=distance(e,target);e.facing=Math.atan2(target.y-e.y,target.x-e.x);if(d<=range+target.radius){if(e.attackCooldown<=0){e.attackCooldown=e.attackPeriod;emit(s,{type:range>2?'projectile':'attack',x:e.x,y:e.y,targetX:target.x,targetY:target.y,team:e.team,entityId:e.id,subtype:e.type});dealDamage(s,e,target,combatDamage(s,e,target));}}else if(e.kind!=='building'&&e.order.type!=='hold')moveToward(s,e,target,dt);
  }else{e.targetId=null;if(e.kind!=='building'&&(e.order.type==='move'||e.order.type==='attackMove'||e.order.type==='capture')){const goal=e.order;if(distance(e,goal)>.3)moveToward(s,e,goal,dt);else if(e.order.type!=='capture')setOrder(e,{type:'idle'});}}
 }
 // Gentle deterministic local separation preserves readable squads without physics dependency.
 if(s.tick%2===0)for(let i=0;i<alive.length;i++){const a=alive[i];if(a.kind==='building'||a.hp<=0)continue;for(let j=i+1;j<alive.length;j++){const b=alive[j];if(b.kind==='building'||b.hp<=0)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=(a.radius+b.radius)*.8;if(d<min&&d>.001){const push=(min-d)*.2,px=dx/d*push,py=dy/d*push;if(isWalkable(s.map,a.x-px,a.y-py)&&!blockers(s).has(tileIndex(s.map,a.x-px,a.y-py))){a.x-=px;a.y-=py;}if(isWalkable(s.map,b.x+px,b.y+py)&&!blockers(s).has(tileIndex(s.map,b.x+px,b.y+py))){b.x+=px;b.y+=py;}}}}
 // Preserve commanders for respawning; other fallen objects are transient events only.
 s.entities=s.entities.filter(e=>e.hp>0||e.kind==='commander');
}
function updatePopulation(s:GameState){for(const p of s.players){let cap=0,pop=0;for(const e of s.entities)if(e.team===p.team&&living(e)){if(e.kind==='unit')pop+=UNITS[e.type as UnitId].population;if(e.kind==='building'&&e.type!=='turret'&&active(e))cap+=BUILDINGS[e.type as BuildingId].population;for(const q of e.queue)if(q.type==='unit')pop+=UNITS[q.id as UnitId].population;}p.population=pop;p.populationCap=Math.min(p.maxPopulation,cap);}}
function updateEconomy(s:GameState,dt:number){
 for(const p of s.players)if(!p.defeated){const modifier=(1+(p.research.economy??0)*.25)*BIOMES[s.map.biome].income*(s.settings.modifiers?.income??1);let gold=.45,wood=.45;
  for(const node of s.map.nodes)if(node.owner===p.team&&node.kind!=='relic'&&node.amount>0){const depot=s.entities.some(e=>e.team===p.team&&e.type==='depot'&&active(e)&&distance(e,node)<7);const amount=Math.min(node.amount,node.income*modifier*(depot?1.35:1)*dt);node.amount-=amount;if(node.kind==='gold')gold+=amount/dt;else wood+=amount/dt;if(node.amount<=0)emit(s,{type:'alert',x:node.x,y:node.y,team:p.team,text:`${node.kind==='gold'?'Gold mine':'Timber grove'} depleted. Expand to a fresh deposit.`});}
  p.gold+=gold*dt;p.wood+=wood*dt;p.stats.goldCollected+=gold*dt;p.stats.woodCollected+=wood*dt;
 }
}
function updateCapture(s:GameState,dt:number){
 for(const node of s.map.nodes){const pressure=new Map<number,number>();for(const e of s.entities)if(living(e)&&e.kind!=='building'&&!s.players[e.team].defeated&&distance(e,node)<node.radius)pressure.set(e.team,(pressure.get(e.team)??0)+(e.kind==='commander'?2:1));
  if(pressure.size!==1){if(pressure.size===0)node.captureProgress=Math.max(0,node.captureProgress-dt*.03);continue;}
  const [team,count]=[...pressure][0];if(node.owner===team){node.captureProgress=Math.max(0,node.captureProgress-dt*.15);if(node.captureProgress===0)node.captureTeam=null;continue;}
  if(node.captureTeam!==team){node.captureTeam=team;node.captureProgress=0;}
  node.captureProgress+=dt*Math.min(3,count)/18*(s.settings.modifiers?.captureSpeed??1);
  if(node.captureProgress>=1){node.owner=team;node.captureProgress=0;node.captureTeam=null;s.players[team].stats.captures++;emit(s,{type:'capture',x:node.x,y:node.y,team,subtype:node.kind,text:node.kind==='relic'?'Relic secured':'Resource point secured'});}
 }
 if(s.settings.mode!=='conquest')for(const p of s.players)if(!p.defeated){const count=s.map.nodes.filter(n=>n.kind==='relic'&&n.owner===p.team).length;const controlRate=count===0?0:count===1?.5:count===2?1:1.4+(count-3)*.3;p.score+=controlRate*dt*s.escalation*(s.settings.mode==='relic'?1.15:1);}
}
export function updateFog(s:GameState){
 const {width,height}=s.map;for(const p of s.players){const visible=s.fog.visible[p.team];visible.fill(0);for(const e of s.entities)if(e.team===p.team&&active(e)){const r=e.vision*BIOMES[s.map.biome].vision,minX=Math.max(0,Math.floor(e.x-r)),maxX=Math.min(width-1,Math.ceil(e.x+r)),minY=Math.max(0,Math.floor(e.y-r)),maxY=Math.min(height-1,Math.ceil(e.y+r));for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if((x+.5-e.x)**2+(y+.5-e.y)**2<=r*r){const i=y*width+x;visible[i]=1;s.fog.explored[p.team][i]=1;}}for(const n of s.map.nodes)if(n.owner===p.team)for(let y=Math.max(0,Math.floor(n.y-3));y<Math.min(height,n.y+3);y++)for(let x=Math.max(0,Math.floor(n.x-3));x<Math.min(width,n.x+3);x++){const i=y*width+x;visible[i]=1;s.fog.explored[p.team][i]=1;}}
 s.lastFogTick=s.tick;
}
function endGame(s:GameState,team:number,reason:string){if(s.winner!==null)return;s.winner=team;s.victoryReason=reason;emit(s,{type:'victory',x:s.map.spawns[team].x,y:s.map.spawns[team].y,team,text:reason});}
function checkVictory(s:GameState){const remaining=s.players.filter(p=>!p.defeated);if(remaining.length===1){endGame(s,remaining[0].team,'All enemy Command Keeps destroyed');return;}for(const p of remaining)if(p.score>=s.scoreTarget){endGame(s,p.team,'Relic domination');return;}
 // In conquest only, the late frontier storm damages all keeps after twice the target duration.
 // Leading armies must commit; tied fortresses cannot keep a headless match alive forever.
 if(s.settings.mode==='conquest'&&s.time>s.settings.duration*120){for(const p of remaining){const keep=s.entities.find(e=>e.team===p.team&&e.type==='keep'&&living(e));if(keep)keep.hp=Math.max(1,keep.hp-FIXED_STEP*(2+(s.time-s.settings.duration*120)/60));}if(s.time>s.settings.duration*180){const ranked=[...remaining].sort((a,b)=>{const score=(p:Player)=>s.entities.filter(e=>e.team===p.team&&living(e)).reduce((sum,e)=>sum+e.hp,0)+p.stats.damageDealt*.1;return score(b)-score(a)||a.team-b.team;});endGame(s,ranked[0].team,'Frontier storm: strongest surviving army');}}
}
function updateScripts(s:GameState){for(const trigger of s.triggers){if(trigger.fired)continue;const w=trigger.when;let fire=false;if(w.type==='time')fire=s.time>=w.seconds;if(w.type==='captured')fire=s.map.nodes.some(n=>n.id===w.nodeId&&n.owner===w.team);if(w.type==='resource')fire=(s.players[w.team]?.[w.resource]??0)>=w.amount;if(w.type==='destroyed')fire=!s.entities.some(e=>e.id===w.entityId&&living(e));if(w.type==='region')fire=s.entities.some(e=>e.team===w.team&&living(e)&&distance(e,w)<=w.radius);if(fire){trigger.fired=true;for(const action of trigger.actions)applyScriptAction(s,action);}}}
function applyScriptAction(s:GameState,a:ScriptAction){if(a.type==='dialogue')emit(s,{type:'dialogue',x:0,y:0,team:a.team??0,text:a.text});if(a.type==='resources'){s.players[a.team].gold+=a.gold;s.players[a.team].wood+=a.wood;}if(a.type==='spawn')for(let i=0;i<a.count;i++)spawnEntity(s,a.team,'unit',a.unit,a.x+(i%3)*.7,a.y+Math.floor(i/3)*.7);if(a.type==='victory')endGame(s,a.team,'Mission objectives complete');if(a.type==='reveal'){s.fog.explored[a.team].fill(1);s.fog.visible[a.team].fill(1);}if(a.type==='objective')s.objectiveText=a.text;}
export function stepGame(s:GameState,elapsedSeconds:number):void{
 if(s.paused||s.winner!==null||!Number.isFinite(elapsedSeconds)||elapsedSeconds<=0)return;
 s.accumulator+=elapsedSeconds;
 while(s.accumulator+1e-9>=FIXED_STEP&&s.winner===null&&!s.paused){s.accumulator-=FIXED_STEP;if(s.accumulator<1e-9)s.accumulator=0;s.tick++;s.time=s.tick*FIXED_STEP;s.escalation=1+Math.max(0,s.time/(s.settings.duration*60)-.5)*1.4;
  s.events=s.events.filter(e=>s.time-e.time<2.5);
  if(s.tick-s.lastFogTick>=5)updateFog(s);
  updateEconomy(s,FIXED_STEP);updateEntities(s,FIXED_STEP);updateCapture(s,FIXED_STEP);updatePopulation(s);updateScripts(s);for(const p of s.players)if(p.ai&&!p.defeated&&s.time>=p.aiNextThink)thinkAI(s,p);checkVictory(s);
 }
}
function tryAIBuild(s:GameState,p:Player,id:BuildingId,origin?:Point):boolean{
 const center=origin??s.map.spawns[p.team];const phase=p.team*.7;
 for(let ring=3;ring<=8;ring+=1.25)for(let i=0;i<16;i++){const a=i*Math.PI/8+phase,x=Math.round((center.x+Math.cos(a)*ring)*2)/2,y=Math.round((center.y+Math.sin(a)*ring)*2)/2;if(canBuild(s,p.team,id,x,y).ok)return issueCommand(s,{type:'build',team:p.team,building:id,x,y}).ok;}
 return false;
}
function aiOrder(s:GameState,p:Player,entities:Entity[],goal:Point,nodeId?:string){
 for(const e of entities){if(!living(e))continue;const order=e.order;if((order.type==='capture'||order.type==='attackMove')&&distance(order,goal)<2)continue;setOrder(e,nodeId?{type:'capture',x:goal.x,y:goal.y,nodeId}:{type:'attackMove',x:goal.x,y:goal.y});}
}
function thinkAI(s:GameState,p:Player){
 const interval={easy:4.2,normal:2.5,hard:1.5,brutal:.8}[s.settings.difficulty];p.aiNextThink=s.time+interval;
 const mine=s.entities.filter(e=>e.team===p.team&&living(e)),buildings=mine.filter(e=>e.kind==='building'),army=mine.filter(e=>e.kind==='unit'),commander=mine.find(e=>e.kind==='commander'),spawn=s.map.spawns[p.team];
 const has=(id:BuildingId)=>buildings.some(e=>e.type===id),ready=(id:BuildingId)=>buildings.some(e=>e.type===id&&active(e));
 const visibleEnemies=s.entities.filter(e=>e.team!==p.team&&living(e)&&!s.players[e.team].defeated&&isVisible(s,p.team,e.x,e.y));p.lastKnownEnemies=visibleEnemies.slice(0,12).map(e=>({x:e.x,y:e.y}));
 if(p.population>=p.populationCap-3&&p.populationCap<p.maxPopulation&&!buildings.some(e=>e.type==='house'&&e.buildProgress<1))tryAIBuild(s,p,'house');
 if(!has('range')&&s.time>20)tryAIBuild(s,p,'range');
 if(!has('stable')&&s.time>100&&p.gold>145)tryAIBuild(s,p,'stable');
 if(!has('blacksmith')&&s.time>140&&p.gold>180)tryAIBuild(s,p,'blacksmith');
 if(!has('workshop')&&s.time>210&&ready('blacksmith')&&p.gold>180)tryAIBuild(s,p,'workshop');
 if(p.personality==='defensive'&&s.time>65&&buildings.filter(e=>e.type==='tower').length<2&&p.gold>130)tryAIBuild(s,p,'tower');
 if((p.personality==='economic'||p.personality==='expansionist')&&s.time>90&&!has('depot')){const n=s.map.nodes.find(n=>n.owner===p.team&&n.kind==='gold');if(n)tryAIBuild(s,p,'depot',n);}
 if(s.time>80&&p.gold>190&&p.wood>155&&(p.research.economy??0)<1)issueCommand(s,{type:'research',team:p.team,technology:'economy'});
 if(s.time>210&&p.gold>270&&p.wood>170){const techs:TechId[]=['steel','armor','fletching','logistics','veterancy'];const choice=techs.find(t=>(p.research[t]??0)<1);if(choice)issueCommand(s,{type:'research',team:p.team,technology:choice});}
 // Counter choices use sighted forces, never hidden enemy unit state.
 const cavalry=visibleEnemies.filter(e=>e.type==='cavalry').length,ranged=visibleEnemies.filter(e=>e.type==='archer').length,infantry=visibleEnemies.filter(e=>e.type==='swordsman'||e.type==='spearman').length;
 const choices:UnitId[]=[];
 if(ready('workshop')&&army.filter(e=>e.type==='siege').length<Math.max(1,Math.floor(army.length/10)))choices.push('siege');
 if(ready('range')&&army.length>6&&army.filter(e=>e.type==='support').length<Math.floor(army.length/9))choices.push('support');
 if(cavalry>ranged+1)choices.push('spearman');else if(ranged>infantry&&ready('stable'))choices.push('cavalry');else if(infantry>3&&ready('range'))choices.push('archer');
 const cycle:UnitId[]=['swordsman','archer','spearman','archer','cavalry','swordsman'];choices.push(cycle[Math.floor(s.time/interval+p.team)%cycle.length],'swordsman','spearman');
 const savingForExpansion=(!has('range')&&s.time>20)||(s.time>160&&!has('blacksmith'))||(s.time>260&&ready('blacksmith')&&!has('workshop'));
 for(const id of savingForExpansion?[]:choices){if(issueCommand(s,{type:'recruit',team:p.team,unit:id}).ok)break;}
 const threats=visibleEnemies.filter(e=>e.kind!=='building'&&distance(e,spawn)<11);
 let goal:Point|undefined,nodeId:string|undefined;
 if(threats.length>=2){goal=threats[0];p.aiPhase='Defending the command keep';}
 else{
  const deposits=s.map.nodes.filter(n=>n.kind!=='relic'&&n.owner!==p.team&&n.amount>100&&(n.owner===null||isVisible(s,p.team,n.x,n.y))).sort((a,b)=>distance(a,commander??spawn)-distance(b,commander??spawn));
  const relics=s.map.nodes.filter(n=>n.kind==='relic'&&n.owner!==p.team).sort((a,b)=>distance(a,commander??spawn)-distance(b,commander??spawn));
  const owned=s.map.nodes.filter(n=>n.kind!=='relic'&&n.owner===p.team&&n.amount>100).length;
  if(deposits.length&&(s.time<90||owned<2||(p.personality==='economic'&&s.time<160))){goal=deposits[0];nodeId=deposits[0].id;p.aiPhase='Expanding the economy';}
  else if(relics.length&&(s.settings.mode!=='conquest'||army.length<12)){goal=relics[0];nodeId=relics[0].id;p.aiPhase='Contesting the relics';}
  else if(s.settings.mode!=='conquest'&&army.length<18&&s.time<s.settings.duration*45){const defend=s.map.nodes.filter(n=>n.kind==='relic'&&n.owner===p.team).sort((a,b)=>distance(a,spawn)-distance(b,spawn))[0];if(defend){goal=defend;nodeId=defend.id;p.aiPhase='Holding the relic line';}}
  else{const enemy=s.players.filter(q=>q.team!==p.team&&!q.defeated).sort((a,b)=>b.score-a.score)[0];if(enemy){goal=s.map.spawns[enemy.team];p.aiPhase='Assaulting the enemy keep';}}
 }
 if(goal){
  const fighters=[...army,...(commander?[commander]:[])];
  // A small detached patrol captures a second point while the commander leads the main force.
  if(army.length>=8&&threats.length===0){const secondary=s.map.nodes.filter(n=>n.owner!==p.team&&n.id!==nodeId&&(n.kind==='relic'||n.amount>100)).sort((a,b)=>distance(a,spawn)-distance(b,spawn))[0];if(secondary){const patrol=army.filter(e=>e.type==='cavalry'||e.type==='spearman').slice(-2);aiOrder(s,p,patrol,secondary,secondary.id);aiOrder(s,p,fighters.filter(e=>!patrol.includes(e)),goal,nodeId);}else aiOrder(s,p,fighters,goal,nodeId);}else aiOrder(s,p,fighters,goal,nodeId);
  for(const building of buildings)if(building.type!=='turret')building.rally={x:goal.x,y:goal.y};
 }
 if(commander){
  const enemies=visibleEnemies.filter(e=>distance(e,commander)<8),hurt=mine.filter(e=>e.hp<e.maxHp*.7&&distance(e,commander)<7);
  if(s.settings.difficulty!=='easy')for(const ability of COMMANDERS[commander.type as CommanderId].abilities){const offensive=['charge','trap','turret'].includes(ability.id),defensive=['repair','rally'].includes(ability.id);if((offensive&&enemies.length>=2)||(defensive&&hurt.length>=2)||(ability.id==='dodge'&&commander.hp<commander.maxHp*.4&&enemies.length)){const target=ability.id==='dodge'?spawn:enemies[0];issueCommand(s,{type:'ability',team:p.team,ability:ability.id,x:target?.x,y:target?.y});}}
  if(commander.hp<commander.maxHp*.2&&s.settings.difficulty!=='easy'){setOrder(commander,{type:'move',x:spawn.x+3,y:spawn.y});p.aiPhase='Regrouping the commander';}
 }
}
export function serializeGame(state:GameState):string{return JSON.stringify(state);}
export function restoreGame(input:string|object):GameState{
 let data:GameState;try{data=(typeof input==='string'?JSON.parse(input):JSON.parse(JSON.stringify(input))) as GameState;}catch{throw new Error('This save is not valid JSON.');}
 if(!data||typeof data!=='object'||data.version!==1)throw new Error('This save was created by an unsupported Frontier Command version.');
 if(!data.map||!Array.isArray(data.entities)||!Array.isArray(data.players)||!data.players.length||!Number.isFinite(data.time)||!Number.isFinite(data.tick))throw new Error('This save is incomplete or damaged.');
 const validation=validateMap(data.map);if(!validation.valid)throw new Error(`Saved map is invalid: ${validation.errors.join(' ')}`);
 if(data.entities.some(e=>!Number.isFinite(e.x)||!Number.isFinite(e.y)||!Number.isFinite(e.hp)||!Number.isFinite(e.maxHp)||!data.players[e.team]||!e.order||!Array.isArray(e.queue)))throw new Error('Saved entities are invalid.');
 data.settings={...DEFAULT_SETTINGS,...data.settings};data.accumulator??=0;data.events??=[];data.pendingCommands??=[];data.commandLog??=[];data.triggers??=[];data.navigationVersion??=0;
 updatePopulation(data);return data;
}
