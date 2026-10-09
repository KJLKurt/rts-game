import { describe, expect, it } from 'vitest';
import { createGame, issueCommand, restoreGame, serializeGame } from '../src/sim';
import { commanderRecoveryPresentation } from '../src/ui/commander-recovery';

function recovering() {
    const state = createGame({seed: 'recovery-copy', difficulty: 'easy'});
    const hero = state.entities.find(entity => entity.team === 0 && entity.kind === 'commander')!;
    hero.hp = 0;
    hero.respawnAt = 24;
    return {state, hero};
}

describe('commander recovery disclosure', () => {
    it('reports game seconds with upward rounding and an explicit paused reason', () => {
        const {state} = recovering();
        state.time = 3.1;
        state.paused = true;
        const before = serializeGame(state);
        const result = commanderRecoveryPresentation(state)!;
        expect(result.state).toBe('recovering');
        expect(result.heading).toBe('Commander recovering');
        expect(result.seconds).toBe(21);
        expect(result.detail).toBe('Paused · abilities unavailable');
        expect(result.abilityReason).toContain('21 game seconds');
        expect(result.abilityReason).toContain('countdown is paused');
        expect(commanderRecoveryPresentation(state)).toEqual(result);
        expect(serializeGame(state)).toBe(before);
    });

    it('restores the same remaining recovery, then removes stale copy after respawn and another death', () => {
        const {state, hero} = recovering();
        state.tick = 70; state.time = 7; state.paused = true;
        const restored = restoreGame(serializeGame(state));
        expect(commanderRecoveryPresentation(restored)).toEqual(commanderRecoveryPresentation(state));
        state.paused = false;
        expect(commanderRecoveryPresentation(state)?.detail).toBe('Abilities unavailable');
        hero.hp = hero.maxHp; hero.respawnAt = null;
        expect(commanderRecoveryPresentation(state)).toBeNull();
        hero.hp = 0; hero.respawnAt = 31;
        expect(commanderRecoveryPresentation(state)?.seconds).toBe(24);
    });

    it('never gives a negative countdown at a due recovery boundary', () => {
        const {state} = recovering();
        state.time = 24.01;
        expect(commanderRecoveryPresentation(state)?.seconds).toBe(0);
    });

    it('does not promise a respawn when no timer exists or the player is defeated', () => {
        const {state, hero} = recovering();
        hero.respawnAt = null;
        expect(commanderRecoveryPresentation(state)).toMatchObject({state: 'unavailable', seconds: null, buttonLabel: 'Unavailable'});
        hero.respawnAt = 24;
        state.players[0].defeated = true;
        expect(commanderRecoveryPresentation(state)?.seconds).toBeNull();
        expect(commanderRecoveryPresentation(state)?.abilityReason).not.toContain('Returns in');
    });

    it('explains allied spectating without a recovery timer', () => {
        const state = createGame({seed: 'spectator-copy', aiPlayers: 2});
        state.players[0].alliance = state.players[2].alliance = 0;
        state.players[1].alliance = 1;
        state.players[0].defeated = true;
        state.entities.find(entity => entity.team === 0 && entity.kind === 'commander')!.hp = 0;
        expect(commanderRecoveryPresentation(state)).toMatchObject({state: 'unavailable', heading: 'Your keep fell', detail: 'Watching your surviving allies', seconds: null});
    });

    it('does not promise recovery after a surrendered battle with no winner', () => {
        const state = createGame({seed: 'surrender-recovery-copy', aiPlayers: 2});
        // A scenario with only allied sides has no eligible rival winner.
        state.players.forEach(player => { player.alliance = 0; });
        const hero = state.entities.find(entity => entity.team === 0 && entity.kind === 'commander')!;
        hero.hp = 0; hero.respawnAt = 24;
        expect(issueCommand(state, {type: 'surrender', team: 0}).ok).toBe(true);
        expect(state.winner).toBeNull();
        expect(commanderRecoveryPresentation(state)).toMatchObject({state: 'unavailable', seconds: null});
    });
});
