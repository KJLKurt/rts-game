import type {UnitDefinition, BuildingDefinition, CommanderDefinition, FactionDefinition, TechnologyDefinition, BiomeDefinition, GameSettings, TerrainType, UnitId, BuildingId, CommanderId, FactionId, TechId, BiomeId} from './types';
export const UNITS:Record<UnitId,UnitDefinition> = {
 swordsman:{id:'swordsman',name:'Swordsman',description:'Reliable armored infantry. Punishes exposed archers and support.',cost:{gold:45,wood:10},hp:125,damage:16,armor:3,range:1.15,speed:2.3,cooldown:1.1,vision:7,population:1,trainTime:10,building:'barracks',counter:{archer:1.25,support:1.35}},
 spearman:{id:'spearman',name:'Spearman',description:'Long spears stop cavalry charges. Best in a supporting line.',cost:{gold:35,wood:20},hp:105,damage:14,armor:1,range:1.55,speed:2.3,cooldown:1.15,vision:7,population:1,trainTime:9,building:'barracks',counter:{cavalry:1.85}},
 archer:{id:'archer',name:'Archer',description:'Ranged damage. Effective against infantry; vulnerable to cavalry.',cost:{gold:35,wood:35},hp:72,damage:12,armor:0,range:5.6,speed:2.5,cooldown:1.3,vision:9,population:1,trainTime:11,building:'range',counter:{swordsman:1.25,spearman:1.3,cavalry:0.8}},
 cavalry:{id:'cavalry',name:'Cavalry',description:'Fast raiders. Flank ranged troops and disrupt resource lines.',cost:{gold:85,wood:20},hp:195,damage:23,armor:2,range:1.25,speed:3.5,cooldown:1.2,vision:9,population:2,trainTime:17,building:'stable',counter:{archer:1.65,support:1.55,spearman:0.85}},
 siege:{id:'siege',name:'Runebreaker',description:'Slow arcane artillery. Breaks fortifications from a safe distance.',cost:{gold:135,wood:95},hp:160,damage:36,armor:1,range:7.5,speed:1.45,cooldown:2.7,vision:8,population:3,trainTime:24,building:'workshop',counter:{building:2.8,cavalry:0.65}},
 support:{id:'support',name:'Mender',description:'Restores nearby allies between attacks. Keep behind your frontline.',cost:{gold:75,wood:35},hp:80,damage:8,armor:0,range:4.4,speed:2.5,cooldown:1.5,vision:9,population:2,trainTime:16,building:'range',counter:{}}
};
export const BUILDINGS:Record<BuildingId,BuildingDefinition> = {
 keep:{id:'keep',name:'Command Keep',description:'Your command center. Protect it to stay in the battle.',cost:{gold:400,wood:350},hp:6400,buildTime:45,size:2,vision:11,population:12,prerequisites:[],recruits:['swordsman','spearman'],damage:42,range:8.5},
 house:{id:'house',name:'House',description:'Adds 8 population capacity.',cost:{gold:0,wood:65},hp:350,buildTime:12,size:1,vision:5,population:8,prerequisites:[],recruits:[]},
 barracks:{id:'barracks',name:'Barracks',description:'Recruits swordsmen and spearmen.',cost:{gold:55,wood:100},hp:750,buildTime:20,size:1.4,vision:7,population:0,prerequisites:[],recruits:['swordsman','spearman']},
 range:{id:'range',name:'Archery Range',description:'Recruits archers and menders.',cost:{gold:65,wood:120},hp:650,buildTime:22,size:1.4,vision:7,population:0,prerequisites:[],recruits:['archer','support']},
 stable:{id:'stable',name:'Stable',description:'Recruits swift cavalry. Requires a barracks.',cost:{gold:105,wood:145},hp:850,buildTime:27,size:1.5,vision:7,population:0,prerequisites:['barracks'],recruits:['cavalry']},
 workshop:{id:'workshop',name:'Rune Workshop',description:'Builds siege engines. Requires a blacksmith.',cost:{gold:150,wood:170},hp:800,buildTime:32,size:1.5,vision:7,population:0,prerequisites:['blacksmith'],recruits:['siege']},
 tower:{id:'tower',name:'Watchtower',description:'Controls a narrow approach with ranged fire.',cost:{gold:70,wood:100},hp:750,buildTime:25,size:.85,vision:11,population:0,prerequisites:[],recruits:[],damage:22,range:7.2},
 depot:{id:'depot',name:'Resource Depot',description:'Boosts nearby captured deposits by 35%. Enables forward construction.',cost:{gold:50,wood:90},hp:500,buildTime:18,size:1,vision:8,population:0,prerequisites:[],recruits:[]},
 blacksmith:{id:'blacksmith',name:'Blacksmith',description:'Unlocks military research and rune workshops.',cost:{gold:90,wood:130},hp:650,buildTime:24,size:1.25,vision:7,population:0,prerequisites:['barracks'],recruits:[]}
};
export const COMMANDERS:Record<CommanderId,CommanderDefinition> = {
 warlord:{id:'warlord',name:'Warlord',description:'An armored frontline leader. Charge into battle and rally your army.',hp:620,damage:30,armor:5,range:1.6,speed:3.1,vision:9,cooldown:.85,abilities:[{id:'charge',name:'Charge',description:'Rush toward a target, damaging and slowing nearby enemies.',cooldown:12,key:'Q'},{id:'rally',name:'Rally',description:'Heal nearby allies and boost their damage for 8 seconds.',cooldown:22,key:'E'}]},
 ranger:{id:'ranger',name:'Ranger',description:'A swift ranged scout. Dodge danger and trap pursuing enemies.',hp:410,damage:25,armor:1,range:6.6,speed:3.8,vision:13,cooldown:.8,abilities:[{id:'dodge',name:'Windstep',description:'Leap toward a target and briefly evade all damage.',cooldown:7,key:'Q'},{id:'trap',name:'Thorn Trap',description:'Damage and slow enemies around the target area.',cooldown:16,key:'E'}]},
 engineer:{id:'engineer',name:'Engineer',description:'A versatile builder who deploys runic turrets and repairs the line.',hp:500,damage:20,armor:3,range:4.8,speed:3,vision:10,cooldown:.95,abilities:[{id:'turret',name:'Runic Turret',description:'Deploy a temporary automatic turret for 30 seconds.',cooldown:25,key:'Q'},{id:'repair',name:'Field Repair',description:'Restore nearby friendly units and fortifications.',cooldown:20,key:'E'}]}
};
export const FACTIONS:Record<FactionId,FactionDefinition> = {
 ironhold:{id:'ironhold',name:'Ironhold',description:'Stalwart infantry and fortifications. +15% health, +20% building health.',color:'#48a7ec',symbol:'◆',damage:1,health:1.15,speed:.96,cost:1,buildingHealth:1.2},
 wildborn:{id:'wildborn',name:'Wildborn',description:'Fast, affordable warbands. +12% speed, −10% recruitment costs.',color:'#efae4f',symbol:'▲',damage:1,health:.95,speed:1.12,cost:.9,buildingHealth:1},
 arcanists:{id:'arcanists',name:'Arcanists',description:'Runic firepower. +12% damage and greater support healing.',color:'#bc8aef',symbol:'●',damage:1.12,health:1,speed:1,cost:1.03,buildingHealth:1.05}
};
export const TECHNOLOGIES:Record<TechId,TechnologyDefinition> = {
 steel:{id:'steel',name:'Tempered Steel',description:'+15% damage for melee troops and siege per level.',cost:{gold:120,wood:60},time:30,building:'blacksmith',maxLevel:2},
 armor:{id:'armor',name:'Runic Armor',description:'+2 armor for all troops and commander per level.',cost:{gold:100,wood:80},time:30,building:'blacksmith',maxLevel:2},
 fletching:{id:'fletching',name:'Farshot',description:'+1 range and +12% damage for archers per level.',cost:{gold:110,wood:100},time:32,building:'range',maxLevel:2},
 economy:{id:'economy',name:'Efficient Harvest',description:'+25% resource generation per level.',cost:{gold:100,wood:100},time:25,building:'keep',maxLevel:2},
 logistics:{id:'logistics',name:'Field Logistics',description:'+15% movement speed and 15% faster training.',cost:{gold:160,wood:100},time:35,building:'keep',maxLevel:1},
 veterancy:{id:'veterancy',name:'Commander Mastery',description:'+25% commander health and 20% faster ability cooldowns.',cost:{gold:200,wood:80},time:40,building:'keep',maxLevel:1}
};
const palette:Record<TerrainType,string>={grass:'#668d4b',forest:'#365f42',water:'#326b8b',rock:'#77786d',sand:'#cbb276',snow:'#c6d9d5',road:'#9e936d',marsh:'#577f6b'};
export const BIOMES:Record<BiomeId,BiomeDefinition>={
 grasslands:{id:'grasslands',name:'Emerald March',description:'Balanced open ground and wooded flank routes.',vision:1,speed:1,income:1,primary:'grass',colors:palette},
 forest:{id:'forest',name:'Whisperwood',description:'Dense woods reduce sight. Heavy troops move slowly through cover.',vision:.82,speed:.96,income:1.08,primary:'grass',colors:{...palette,grass:'#527e4c',forest:'#294f38',road:'#9a875d'}},
 desert:{id:'desert',name:'Sunscar Expanse',description:'Open sight lines, precious resources, exposed approaches.',vision:1.2,speed:1.03,income:.92,primary:'sand',colors:{...palette,grass:'#a0a469',forest:'#7b894e',road:'#b29764'}},
 snow:{id:'snow',name:'Frostveil',description:'Snow slows armies; marked roads make fast attack corridors.',vision:1.05,speed:.88,income:1,primary:'snow',colors:{...palette,forest:'#648784',rock:'#a4afae',road:'#9fa99d',water:'#5a91a6'}}
};
export const DEFAULT_SETTINGS:GameSettings={seed:'FRONTIER-492817',biome:'grasslands',mapSize:'medium',difficulty:'normal',commander:'warlord',faction:'ironhold',mode:'domination',duration:18,aiPlayers:1,aiControlPlayer:false,aiPersonality:'adaptive',populationCap:80,startingGold:230,startingWood:260,resourceAbundance:1,terrainRoughness:.45,water:.12,objectiveDensity:1,weirdness:0,preset:'balanced'};
export const MAP_DIMENSIONS={tiny:32,small:42,medium:54,large:68,huge:84} as const;
export const TEAM_COLORS=['#56c5ff','#ff9169','#ce93ff','#f5d46a','#7de0ab','#fa8bc9'];
export const TEAM_SYMBOLS=['◆','▲','●','■','✦','✚'];
export const FIXED_STEP=.1;
export function validateContent():string[]{
 const errors:string[]=[];
 for(const unit of Object.values(UNITS)){if(!BUILDINGS[unit.building])errors.push(`${unit.id}: missing recruitment building`);if(unit.hp<=0||unit.damage<0||unit.trainTime<=0)errors.push(`${unit.id}: invalid stats`);}
 for(const building of Object.values(BUILDINGS)){for(const id of building.recruits)if(!UNITS[id])errors.push(`${building.id}: unknown unit ${id}`);for(const id of building.prerequisites)if(!BUILDINGS[id])errors.push(`${building.id}: unknown prerequisite ${id}`);}
 return errors;
}

export const RUSH_UPGRADES = {
 blade:{id:'blade',name:'Keen Steel',description:'Your commander and current squad gain 25% damage.'},
 bulwark:{id:'bulwark',name:'Iron Resolve',description:'Restore all health and gain 35% maximum health.'},
 fleet:{id:'fleet',name:'Windrunner',description:'Your squad gains 20% movement speed and 1 scouting range.'},
 reinforcements:{id:'reinforcements',name:'Fresh Banners',description:'Three veteran soldiers join your squad immediately.'},
 renewal:{id:'renewal',name:'Second Wind',description:'Your commander recovers 3 health each second, even in combat.'},
 focus:{id:'focus',name:'Runic Focus',description:'Abilities recharge 25% faster. Reset their cooldowns now.'}
} as const;
