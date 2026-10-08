import { areHostile, hasBattleEnded, isCompetitivePlayer } from './alliances';
import { distance, tileIndex } from './maps';
import type { Entity, GameState, Point } from './types';

export const BREACH_RANGE = 6;
export const BREACH_DAMAGE = 180;

/** Shared by input, tactical planning and AI. Does not mutate or spend cooldowns.
 * Range is measured center-to-center. An explicit point resolves its structure
 * before eligibility checks, so a hidden/allied/dead structure never redirects
 * a shot toward a nearby eligible one. */
export function findBreachTarget(state: GameState, commander: Entity, point?: Point): Entity | undefined {
    const player = state.players[commander.team];
    const onMap = (position: Point) => Number.isFinite(position.x) && Number.isFinite(position.y)
        && position.x >= 0 && position.y >= 0 && position.x < state.map.width && position.y < state.map.height;
    if (hasBattleEnded(state) || !isCompetitivePlayer(player) || player.defeated || commander.kind !== 'commander' || commander.type !== 'engineer' || commander.hp <= 0 || !onMap(commander))
        return undefined;
    const eligible = (target: Entity) => target.kind === 'building' && target.hp > 0 && onMap(target)
        && !state.players[target.team]?.defeated && areHostile(state, commander.team, target.team)
        && !!state.fog.visible[commander.team]?.[tileIndex(state.map, target.x, target.y)]
        && distance(commander, target) <= BREACH_RANGE;
    if (point !== undefined) {
        if (!onMap(point))
            return undefined;
        const pointed = state.entities.filter(target => target.kind === 'building' && distance(point, target) <= target.radius + .35)
            .sort((a, b) => distance(point, a) - distance(point, b))[0];
        return pointed && eligible(pointed) ? pointed : undefined;
    }
    return state.entities.filter(eligible).sort((a, b) => distance(commander, a) - distance(commander, b))[0];
}
