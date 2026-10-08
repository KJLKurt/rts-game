import { describe, expect, it } from 'vitest';
import { canPlayerContinue, createGame, FIXED_STEP, hasBattleEnded, hasPlayerSurrendered, issueCommand, playerAllianceWon, playerOutcomeStatus, restoreGame, serializeGame, stepGame, SURRENDER_REASON } from '../../src/sim';
import type { GameSettings, GameState } from '../../src/sim';

function battle(settings: Partial<GameSettings> = {}): GameState {
    const state = createGame({ seed: 'surrender-contract', mapSize: 'small', ...settings });
    state.players.forEach(player => player.ai = false);
    return state;
}
const surrender = (state: GameState) => issueCommand(state, { type: 'surrender', team: 0 });

describe('explicit player surrender', () => {
    it.each([false, true])('ends immediately at the current tick with paused=%s and preserves the combat state', paused => {
        const state = battle(); stepGame(state, .3);
        if (paused) {
            expect(issueCommand(state, { type: 'pause', team: 0, paused: true }).ok).toBe(true);
            expect(issueCommand(state, { type: 'recruit', team: 0, unit: 'swordsman' })).toMatchObject({ ok: true, queued: true });
        }
        const combat = structuredClone({ entities: state.entities, players: state.players, map: state.map });
        const tick = state.tick, time = state.time;
        expect(surrender(state)).toEqual({ ok: true });
        expect(state).toMatchObject({ winner: 1, victoryReason: SURRENDER_REASON, paused, tick, time, pendingCommands: [] });
        expect({ entities: state.entities, players: state.players, map: state.map }).toEqual(combat);
        expect(state.commandLog.at(-1)).toEqual({ tick, command: { type: 'surrender', team: 0 } });
        expect(state.events.filter(event => event.subtype === 'surrender')).toHaveLength(1);
        expect(state.events.some(event => event.type === 'victory' && event.team === 0)).toBe(false);
        expect(hasBattleEnded(state)).toBe(true);
        expect(hasPlayerSurrendered(state)).toBe(true);
        expect(playerOutcomeStatus(state)).toBe('lost');
        expect(playerAllianceWon(state)).toBe(false);
        expect(canPlayerContinue(state)).toBe(false);
        const terminal = serializeGame(state);
        expect(surrender(state)).toEqual({ ok: true });
        expect(issueCommand(state, { type: 'pause', team: 0, paused: false }).ok).toBe(false);
        expect(issueCommand(state, { type: 'hold', team: 0 }).ok).toBe(false);
        stepGame(state, 10);
        expect(serializeGame(state)).toBe(terminal);
    });

    it('records a deterministic command that can be replayed at the same tick', () => {
        const state = battle(), replay = battle();
        issueCommand(state, { type: 'hold', team: 0 });
        stepGame(state, .4);
        surrender(state);
        for (const entry of state.commandLog) {
            stepGame(replay, (entry.tick - replay.tick) * FIXED_STEP);
            expect(issueCommand(replay, entry.command).ok).toBe(true);
        }
        expect(serializeGame(replay)).toBe(serializeGame(state));
    });

    it('concedes with surviving allies instead of spectating or awarding their victory', () => {
        const state = battle({ aiPlayers: 2 });
        state.players[0].alliance = state.players[1].alliance = 0;
        state.players[0].defeated = true;
        expect(playerOutcomeStatus(state)).toBe('spectating');
        expect(surrender(state).ok).toBe(true);
        expect(state.winner).toBe(2);
        expect(state.players[1].defeated).toBe(false);
        expect(playerOutcomeStatus(state)).toBe('lost');
        expect(playerOutcomeStatus(state, 1)).toBe('lost');
        expect(playerAllianceWon(state)).toBe(false);
        expect(canPlayerContinue(state, 1)).toBe(false);
        const restored = restoreGame(serializeGame(state));
        expect(playerOutcomeStatus(restored)).toBe('lost');
        expect(restored.players[1].defeated).toBe(false);
    });

    it.each(['allied', 'defeated', 'closed'] as const)('finishes without inventing a winner when the only rival is %s', rival => {
        const state = battle();
        if (rival === 'allied') state.players[1].alliance = 0;
        else state.players[1].defeated = true;
        if (rival === 'closed') {
            state.players[1].closed = true;
            state.entities = state.entities.filter(entity => entity.team !== 1);
            state.map.nodes.forEach(node => { if (node.owner === 1) node.owner = null; });
        }
        expect(surrender(state).ok).toBe(true);
        expect(state.winner).toBeNull();
        expect(hasBattleEnded(state)).toBe(true);
        expect(playerOutcomeStatus(state)).toBe('lost');
        const restored = restoreGame(serializeGame(state)), saved = serializeGame(restored);
        stepGame(restored, 5);
        expect(surrender(restored)).toEqual({ ok: true });
        expect(issueCommand(restored, { type: 'pause', team: 0, paused: false }).ok).toBe(false);
        expect(canPlayerContinue(restored)).toBe(false);
        expect(serializeGame(restored)).toBe(saved);
    });

    it.each([{ mode: 'rush' }, { scriptedVictory: true }, { mode: 'conquest' } ] as Partial<GameSettings>[])('ends supported battle settings %j without waiting for objective checks', settings => {
        const state = battle(settings);
        state.triggers = [{ id: 'future-victory', when: { type: 'time', seconds: .1 }, actions: [{ type: 'victory', team: 0 }] }];
        expect(surrender(state).ok).toBe(true);
        const restored = restoreGame(serializeGame(state));
        stepGame(restored, 300);
        expect(restored.tick).toBe(0);
        expect(restored.triggers[0].fired).toBeUndefined();
        expect(playerOutcomeStatus(restored)).toBe('lost');
    });

    it('never chooses closed slots or neutral camp owners as the winner of a scenario', () => {
        const map = battle({ aiPlayers: 2, mapSize: 'medium' }).map;
        map.tiles.fill('grass');
        map.scenario = {
            version: 1,
            slots: [0, 1, 2].map(team => ({ name: `Side ${team}`, controller: team === 0 ? 'human' : team === 1 ? 'closed' : 'ai', alliance: team, faction: 'ironhold', commander: 'warlord', personality: 'defensive', difficulty: 'easy' })),
            rules: { mode: 'domination', duration: 18, populationCap: 80, startingGold: 230, startingWood: 260, startingForces: 'standard' },
            startingEntities: [],
            camps: [{ id: 'watch-camp', x: 24.5, y: 24.5, unit: 'swordsman', count: 1, radius: 3, rewardGold: 75, rewardWood: 40 }],
        };
        const state = battle({ customMap: map });
        expect(surrender(state).ok).toBe(true);
        expect(state.winner).toBe(2);
        expect(state.players[3].neutral).toBe(true);
        expect(playerOutcomeStatus(restoreGame(serializeGame(state)))).toBe('lost');
        const alone = battle({ customMap: map }); alone.players[2].defeated = true;
        expect(surrender(alone).ok).toBe(true);
        expect(alone.winner).toBeNull();
        expect(canPlayerContinue(restoreGame(serializeGame(alone)))).toBe(false);
    });

    it('rejects nonlocal, learning and already lost or won battles without mutation', () => {
        const states = [battle(), battle({ learning: true }), battle(), battle(), battle({ scriptedVictory: true, aiPlayers: 2 })];
        states[2].players[0].defeated = true;
        states[3].winner = 0;
        states[4].players[0].defeated = true; states[4].players[1].alliance = 0;
        states.forEach((state, index) => {
            const before = serializeGame(state);
            expect(issueCommand(state, { type: 'surrender', team: index === 0 ? 1 : 0 }).ok).toBe(false);
            expect(serializeGame(state)).toBe(before);
        });
    });

    it('does not infer surrender or defeat from no army or resources', () => {
        const state = battle();
        state.entities = state.entities.filter(entity => entity.kind === 'building');
        state.players[0].gold = state.players[0].wood = 0;
        state.map.nodes.forEach(node => node.owner = null);
        stepGame(state, 1);
        expect(hasPlayerSurrendered(state)).toBe(false);
        expect(hasBattleEnded(state)).toBe(false);
        expect(playerOutcomeStatus(state)).toBe('playing');
        expect(canPlayerContinue(state)).toBe(true);
    });
});

describe('surrender save validation', () => {
    it.each([
        ['missing command', (state: GameState) => { state.commandLog = []; }],
        ['duplicate command', (state: GameState) => { state.commandLog.push(structuredClone(state.commandLog[0])); }],
        ['nonlocal command', (state: GameState) => { state.commandLog[0].command.team = 1; }],
        ['wrong tick', (state: GameState) => { state.commandLog[0].tick++; }],
        ['wrong reason', (state: GameState) => { state.victoryReason = 'Relic domination'; }],
        ['wrong winner', (state: GameState) => { state.winner = 0; }],
        ['missing rival winner', (state: GameState) => { state.winner = null; }],
        ['later command', (state: GameState) => { state.commandLog.push({ tick: state.tick, command: { type: 'hold', team: 0 } }); }],
        ['pending orders', (state: GameState) => { state.pendingCommands = [{ type: 'hold', team: 0 }]; }],
        ['learning result', (state: GameState) => { state.settings.learning = true; }],
        ['already defeated', (state: GameState) => { state.players[0].defeated = true; }],
    ] as const)('rejects an inconsistent terminal result: %s', (_name, mutate) => {
        const state = battle(); surrender(state); mutate(state);
        expect(() => restoreGame(serializeGame(state))).toThrow(/surrender result/);
    });

    it('rejects queued concessions instead of deferring them to Resume', () => {
        const state = battle(); state.paused = true;
        state.pendingCommands = [{ type: 'surrender', team: 0 }];
        expect(() => restoreGame(serializeGame(state))).toThrow(/cannot queue a surrender/);
    });

    it('preserves ordinary saves without a surrender marker or new persistent fields', () => {
        const state = battle(), beforeKeys = Object.keys(state);
        expect(hasPlayerSurrendered(restoreGame(serializeGame(state)))).toBe(false);
        surrender(state);
        expect(Object.keys(state)).toEqual(beforeKeys);
    });
});
