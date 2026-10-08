import { describe, expect, it } from 'vitest';
import { createGame, issueCommand, projectPendingCommands } from '../src/sim';
import { BUILDINGS, TECHNOLOGIES } from '../src/sim/content';
import { renderResearchTree, researchBuildingPath, researchView } from '../src/ui/research';
import { aboutHTML, factionLegendHTML } from '../src/ui/about';
import type { BuildingId, Entity, TechId } from '../src/sim/types';

const game = () => createGame({ seed: 'PRESENTATION', mapSize:'tiny', startingGold:1000, startingWood:1000 });
const addBuilding = (s: ReturnType<typeof game>, type: BuildingId, progress = 1) => {
  const source = s.entities.find(e => e.team === 0 && e.type === 'keep')!;
  const entity: Entity = {...structuredClone(source), id:`test-${type}`, type, buildProgress:progress, queue:[]};
  s.entities.push(entity); return entity;
};
describe('research progression presentation', () => {
  it('shows all six technologies with the exact construction paths and data levels', () => {
    expect(researchBuildingPath('blacksmith')).toEqual(['barracks','blacksmith']);
    expect(researchBuildingPath('range')).toEqual(['range']);
    expect(researchBuildingPath('keep')).toEqual(['keep']);
    const s=game(), html=renderResearchTree(s);
    for(const definition of Object.values(TECHNOLOGIES)) {
      expect(html).toContain(`data-id="${definition.id}"`);
      expect(html).toContain(`0 of ${definition.maxLevel} levels complete`);
      expect(html).toContain(definition.description);
      expect(html).toContain(BUILDINGS[definition.building].name);
    }
    expect(html.match(/data-action="research"/g)).toHaveLength(6);
    expect(html).toContain('Separate technologies do not require one another');
  });
  it('matches the real engine for missing or unfinished research buildings', () => {
    const s=game();
    expect(researchView(s,'steel')).toMatchObject({available:false,status:'Requires completed Blacksmith'});
    expect(issueCommand(s,{type:'research',team:0,technology:'steel'}).ok).toBe(false);
    const smith=addBuilding(s,'blacksmith',.9);
    expect(researchView(s,'steel').available).toBe(false);
    smith.buildProgress=1;
    // A preplaced Blacksmith is sufficient; its historical Barracks construction path is not an extra tech gate.
    expect(researchView(s,'steel').available).toBe(true);
    expect(issueCommand(s,{type:'research',team:0,technology:'steel'}).ok).toBe(true);
  });
  it('shows sequential level-two prices without imposing cross-tech prerequisites', () => {
    const s=game();addBuilding(s,'blacksmith');s.players[0].research.steel=1;
    expect(researchView(s,'steel')).toMatchObject({available:true,level:1,price:{gold:240,wood:120},status:'Research level 2'});
    expect(researchView(s,'armor').available).toBe(true);
    s.players[0].research.steel=2;
    expect(researchView(s,'steel')).toMatchObject({available:false,complete:true,status:'Complete'});
    expect(renderResearchTree(s)).toContain('All levels learned');
  });
  it('reports insufficient funds and full producer queues accurately', () => {
    const s=game();s.players[0].gold=99;
    expect(researchView(s,'economy')).toMatchObject({available:false,status:'Need 100 gold and 100 wood'});
    s.players[0].gold=1000;
    const keep=s.entities.find(e=>e.team===0&&e.type==='keep')!;
    keep.queue=Array.from({length:12},(_,i)=>({type:'unit',id:'swordsman',remaining:10,total:10,queueId:`job-${i}`}));
    expect(researchView(s,'economy').status).toBe('Production queue full');
    expect(issueCommand(s,{type:'research',team:0,technology:'economy'}).error).toBe('Production queue is full.');
  });
  it('presents actual and tactically planned research as queued, never purchasable twice', () => {
    const s=game();
    expect(issueCommand(s,{type:'research',team:0,technology:'economy'}).ok).toBe(true);
    expect(researchView(s,'economy')).toMatchObject({queued:true,available:false,status:'Level 1 in research queue'});
    s.paused=true;
    expect(issueCommand(s,{type:'research',team:0,technology:'logistics'}).ok).toBe(true);
    const projected=projectPendingCommands(s);
    expect(researchView(projected,'logistics')).toMatchObject({queued:true,available:false});
  });
  it('mirrors explicit selected-building routing rather than reporting another producer as ready', () => {
    const s=game(), first=addBuilding(s,'blacksmith'), second={...structuredClone(first),id:'second-smith'};
    s.entities.push(second);
    first.queue=Array.from({length:12},(_,i)=>({type:'unit',id:'swordsman',remaining:10,total:10,queueId:`blocked-${i}`}));
    expect(researchView(s,'steel',0,first.id).available).toBe(false);
    expect(researchView(s,'steel',0,second.id).available).toBe(true);
    expect(issueCommand(s,{type:'research',team:0,technology:'steel',buildingId:second.id}).ok).toBe(true);
  });
  it('does not mutate simulation or add invented technology dependencies', () => {
    const s=game(), before=JSON.stringify(s);renderResearchTree(s);
    expect(JSON.stringify(s)).toBe(before);
    for(const id of Object.keys(TECHNOLOGIES) as TechId[]) expect(researchView(s,id).definition).toBe(TECHNOLOGIES[id]);
  });
});
describe('credits and identity information', () => {
  it('states version, all six source cue names, controls and honest licensing limitations', () => {
    const html=aboutHTML();
    for(const text of ['v0.1.0','Welcome to the Winter Workshop','Lanterns in the Pines','Lanterns on Watch','Clockwork Brigade','A Banner in the Snow','Gather the Fallen Banners','not been independently verified','does not include a project-wide license grant','commercial redistribution clearance','WASD','Shift+Tab','recovered and reconstructed','dashed gold Queued footprints until Resume','Cancel closes only the active preview']) expect(html).toContain(text);
  });
  it('separates faction crests/materials from six team allegiance signals', () => {
    const html=factionLegendHTML();
    for(const text of ['Ironhold','Wildborn','Arcanists','Riveted steel','Carved timber','Faceted crystals','cross, diamond, circle, square, triangle and saltire']) expect(html).toContain(text);
    expect(html.match(/class="faction-crest"/g)).toHaveLength(3);
  });
});
