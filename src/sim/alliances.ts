import type { GameState, Player } from './types';

/** Ownership and orders use player indices. Alliances group combat and victory. */
export function isCompetitivePlayer(player: Player | undefined): player is Player {
    return !!player && !player.neutral && !player.closed;
}
export function areAllied(state: GameState, first: number, second: number): boolean {
    const a = state.players[first], b = state.players[second];
    if (!a || !b) return false;
    if (first === second) return true;
    return isCompetitivePlayer(a) && isCompetitivePlayer(b) && (a.alliance ?? a.team) === (b.alliance ?? b.team);
}
export function areHostile(state: GameState, first: number, second: number): boolean {
    // Peaceful practice is noncombat, including older saves that retain rival keeps.
    // Do not merge alliances: capture ownership, income and normal battles stay unchanged.
    if (state.settings.learning) return false;
    const a = state.players[first], b = state.players[second];
    return !!a && !!b && !a.closed && !b.closed && !areAllied(state, first, second);
}
export function allianceRepresentative(state: GameState, team: number): number {
    return state.players.find(player => isCompetitivePlayer(player) && areAllied(state, team, player.team))?.team ?? team;
}
export function allianceMembers(state: GameState, team: number): Player[] {
    return state.players.filter(player => isCompetitivePlayer(player) && areAllied(state, team, player.team));
}
export function competitivePlayers(state: GameState): Player[] {
    return state.players.filter(isCompetitivePlayer);
}
export function playerAllianceWon(state: GameState, team = 0): boolean {
    if (state.settings.scriptedVictory && team === 0 && state.players[0]?.defeated) return false;
    return state.winner !== null && areAllied(state, state.winner, team);
}
export function playerAllianceDefeated(state: GameState, team = 0): boolean {
    const members = allianceMembers(state, team);
    return !members.length || members.every(player => player.defeated);
}
export function canPlayerContinue(state: GameState, team = 0): boolean {
    return state.winner === null && !(state.settings.scriptedVictory && team === 0 && state.players[0]?.defeated) && !playerAllianceDefeated(state, team);
}
export function playerOutcomeStatus(state: GameState, team = 0): 'playing' | 'spectating' | 'won' | 'lost' {
    if (state.settings.scriptedVictory && team === 0 && state.players[0]?.defeated) return 'lost';
    if (state.winner !== null) return playerAllianceWon(state, team) ? 'won' : 'lost';
    if (playerAllianceDefeated(state, team)) return 'lost';
    return state.players[team].defeated ? 'spectating' : 'playing';
}
