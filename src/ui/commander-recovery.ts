import { hasBattleEnded, playerOutcomeStatus } from '../sim/alliances';
import type { GameState } from '../sim/types';

/** Describe existing recovery rules without advancing time or changing orders. */
export function commanderRecoveryPresentation(state: GameState) {
    const hero = state.entities.find(entity => entity.team === 0 && entity.kind === 'commander');
    if (hero && hero.hp > 0) return null;
    if (playerOutcomeStatus(state) === 'spectating') return {
        state: 'unavailable' as const,
        heading: 'Your keep fell',
        detail: 'Watching your surviving allies',
        seconds: null,
        buttonLabel: 'Unavailable',
        abilityReason: 'Your keep fell. Commander abilities are unavailable while you watch your surviving allies.',
    };
    if (hero && hero.respawnAt !== null && !state.players[0].defeated && !hasBattleEnded(state)) {
        const seconds = Math.ceil(Math.max(0, hero.respawnAt - state.time));
        return {
            state: 'recovering' as const,
            heading: 'Commander recovering',
            detail: state.paused ? 'Paused · abilities unavailable' : 'Abilities unavailable',
            seconds,
            buttonLabel: 'Recovering',
            abilityReason: `Commander recovering at the keep. Returns in ${seconds} game seconds.${state.paused ? ' The countdown is paused.' : ''} Abilities are unavailable until the commander returns.`,
        };
    }
    return {
        state: 'unavailable' as const,
        heading: 'Commander unavailable',
        detail: 'Abilities unavailable',
        seconds: null,
        buttonLabel: 'Unavailable',
        abilityReason: 'Commander unavailable. Abilities require a living commander.',
    };
}
