import { BUILDINGS, TECHNOLOGIES } from '../sim/content';
import { productionRate, PRODUCTION_QUEUE_LIMIT, technologyCost } from '../sim/progression';
import type { BuildingId, GameState, TechId } from '../sim/types';
import { escapeText as esc } from './escape';
import { icon } from './icons';
import { resourceCostHTML } from './battle-readouts';
import { buildingRequirementView } from './prerequisites';

/** Only construction prerequisites exist between branches; tech levels are sequential. */
export function researchBuildingPath(id: BuildingId): BuildingId[] {
  return [...new Set([...BUILDINGS[id].prerequisites.flatMap(researchBuildingPath), id])];
}
export function researchView(state: GameState, id: TechId, team = 0, selectedId?: string, originalState = state) {
  const definition = TECHNOLOGIES[id], player = state.players[team], level = player.research[id] ?? 0;
  const selected = state.entities.find(e => e.id === selectedId && e.team === team && e.kind === 'building' && e.hp > 0 && e.type === definition.building);
  const producer = state.entities.find(e => (!selected || e.id === selected.id) && e.team === team && e.type === definition.building && e.hp > 0 && e.respawnAt === null && e.buildProgress >= 1);
  const queued = state.entities.some(e => e.team === team && e.queue.some(q => q.type === 'research' && q.id === id));
  const price = technologyCost(state, team, id);
  const complete = level >= definition.maxLevel;
  const requirement = buildingRequirementView(originalState, definition.building, team, state, selected?.id);
  const missingProducer = requirement.status === 'constructing' || requirement.status === 'queued'
    ? requirement.label : `Requires completed ${BUILDINGS[definition.building].name}`;
  const status = complete ? 'Complete' : queued ? `Level ${level+1} in research queue` : !producer ? missingProducer : producer.queue.length >= PRODUCTION_QUEUE_LIMIT ? 'Production queue full' : player.gold < price.gold || player.wood < price.wood ? `Need ${price.gold} gold and ${price.wood} wood` : `Research level ${level+1}`;
  return { definition, level, producer, queued, price, complete, status, available: !complete && !queued && !!producer && producer.queue.length < PRODUCTION_QUEUE_LIMIT && player.gold >= price.gold && player.wood >= price.wood };
}
export function renderResearchTree(state: GameState, team = 0, selectedId?: string, originalState = state): string {
  const sources = [...new Set(Object.values(TECHNOLOGIES).map(t => t.building))];
  return `<section class="research-tree" aria-label="Research upgrade tree"><p class="research-intro">Research lasts for this battle. Follow each building path, then advance its technologies one level at a time. Separate technologies do not require one another. To choose the production queue, select a matching building first.</p><div class="research-branches">${sources.map(building => {
    const path = researchBuildingPath(building);
    return `<section class="research-branch" aria-label="${esc(BUILDINGS[building].name)} research"><h3 class="research-path">${path.map((id, i) => {
      const requirement = buildingRequirementView(originalState, id, team, state);
      return `${i ? '<span class="research-arrow" aria-hidden="true">→</span>' : ''}<span class="${requirement.status}" data-prerequisite-state="${requirement.status}">${esc(BUILDINGS[id].name)}<small>${esc(requirement.shortLabel)}</small></span>`;
    }).join('')}</h3><div class="research-nodes">${Object.values(TECHNOLOGIES).filter(t => t.building === building).map(t => {
      const view = researchView(state,t.id,team,selectedId,originalState);
      const seconds = Math.ceil(t.time / (view.producer ? productionRate(view.producer) : 1));
      return `<button class="research-node ${view.complete ? 'completed' : view.queued ? 'queued' : view.available ? 'available' : 'locked'}" data-action="research" data-id="${t.id}" ${view.available ? '' : 'disabled'} aria-label="${esc(`${t.name}. ${view.level} of ${t.maxLevel} levels complete. ${view.status}. ${t.description}`)}"><span class="research-node-title">${icon(view.complete ? 'check' : 'spark')}<strong>${esc(t.name)}</strong></span><span class="research-levels" aria-hidden="true">${Array.from({length:t.maxLevel},(_, i) => `<span class="${i < view.level ? 'done' : i === view.level && view.queued ? 'pending' : ''}">${i < view.level ? '✓' : i+1}</span>${i < t.maxLevel-1 ? '<i>→</i>' : ''}`).join('')}<small>${view.level}/${t.maxLevel}</small></span><span class="research-effect">${esc(t.description)}</span><span class="research-status">${esc(view.status)}</span>${view.complete ? '<span class="research-price">All levels learned</span>' : `<span class="research-price">${resourceCostHTML(view.price)}<span>· ${seconds}s</span>${view.producer?.queue.length && !view.queued ? ' after queued jobs' : ''}</span>`}</button>`;
    }).join('')}</div></section>`;
  }).join('')}</div><p class="research-footnote">Completed buildings unlock research. With no matching selection, the first completed source is used. Each next level costs the base price × its level. Jobs share their building’s production queue; upgrade that building to shorten research time. Effects begin when the job finishes.</p></section>`;
}
