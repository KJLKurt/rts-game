import { distance } from './maps';
import type { GameState, ScriptCondition } from './types';

/** Pure JSON predicates, deliberately without expression evaluation. */
export function evaluateScriptCondition(state: GameState, condition: ScriptCondition): boolean {
    switch (condition.type) {
        case 'all': return condition.conditions.every(child => evaluateScriptCondition(state, child));
        case 'any': return condition.conditions.some(child => evaluateScriptCondition(state, child));
        case 'time': return state.time >= condition.seconds;
        case 'captured': return state.map.nodes.some(node => node.id === condition.nodeId && node.owner === condition.team);
        case 'resource': return (state.players[condition.team]?.[condition.resource] ?? 0) >= condition.amount;
        case 'destroyed': return !state.entities.some(entity => entity.id === condition.entityId && entity.hp > 0);
        case 'region': return state.entities.some(entity => entity.team === condition.team && entity.hp > 0 && distance(entity, condition) <= condition.radius);
        case 'entityLocation': return state.entities.some(entity => entity.id === condition.entityId && entity.hp > 0 && distance(entity, condition) <= condition.radius);
        case 'owned': return state.map.nodes.filter(node => node.kind === condition.kind && node.owner === condition.team).length >= condition.count;
        case 'units': return state.entities.filter(entity => entity.team === condition.team && entity.kind === 'unit' && entity.hp > 0 && entity.buildProgress >= 1 && (!condition.unit || entity.type === condition.unit)).length >= condition.count;
        case 'buildings': return state.entities.filter(entity => entity.team === condition.team && entity.kind === 'building' && entity.hp > 0 && entity.buildProgress >= 1 && (!condition.building || entity.type === condition.building)).length >= condition.count;
        case 'stat': return (state.players[condition.team]?.stats[condition.stat] ?? 0) >= condition.amount;
        case 'teamDefeated': return state.players[condition.team]?.defeated === true;
        case 'research': return (state.players[condition.team]?.research[condition.technology] ?? 0) >= condition.level;
    }
}
