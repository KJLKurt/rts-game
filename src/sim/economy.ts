import { buildingLevel } from './progression';
import { BIOMES, FIXED_STEP } from './content';
import { distance } from './maps';
import type { GameState } from './types';

export interface EconomyWithdrawal {
    /** Stable index into this snapshot's map.nodes array. */
    nodeIndex: number;
    /** Resource to debit during the requested simulation interval. */
    amount: number;
}

export interface EconomyRates {
    /** Expected income per game-second over the requested simulation interval. */
    goldPerSecond: number;
    woodPerSecond: number;
    /** Owned deposits with a positive remaining amount, excluding relics. */
    goldDeposits: number;
    woodDeposits: number;
    /** Pure debit plan. The caller applies these only when advancing simulation. */
    withdrawals: EconomyWithdrawal[];
}

/**
 * Shared simulation/HUD income calculation. Never mutates state or deposits.
 * The default fixed-step horizon includes a deposit's partial final tick, rather
 * than displaying income that cannot be collected. Pause and rendering speed
 * do not change the units: these are rates per game-second, not wall-second.
 * Research, biome, modifiers and depots affect deposits only; escalation affects
 * the keep stipend and Conquest relic stipend only, preserving engine behavior.
 */
export function getEconomyRates(state: GameState, team = 0, stepSeconds = FIXED_STEP): EconomyRates {
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0)
        throw new RangeError('Economy interval must be a positive number of game-seconds.');
    const result: EconomyRates = { goldPerSecond: 0, woodPerSecond: 0, goldDeposits: 0, woodDeposits: 0, withdrawals: [] };
    const player = state.players[team];
    if (!player || player.defeated || state.rush || state.settings.mode === 'rush')
        return result;
    const modifier = (1 + (player.research.economy ?? 0) * .25) * BIOMES[state.map.biome].income * (state.settings.modifiers?.income ?? 1);
    const lateRelics = state.settings.mode === 'conquest' ? state.map.nodes.filter(n => n.kind === 'relic' && n.owner === player.team).length : 0;
    result.goldPerSecond = (.45 + lateRelics * .6) * state.escalation;
    result.woodPerSecond = (.45 + lateRelics * .35) * state.escalation;
    for (const [nodeIndex, node] of state.map.nodes.entries())
        if (node.owner === player.team && node.kind !== 'relic' && node.amount > 0) {
            const depots = state.entities.filter(e => e.team === player.team && e.type === 'depot' && e.hp > 0 && e.buildProgress >= 1 && distance(e, node) < 7);
            const depotBonus = Math.max(0, ...depots.map(e => .35 + (buildingLevel(e) - 1) * .15));
            const amount = Math.min(node.amount, node.income * modifier * (1 + depotBonus) * stepSeconds);
            result.withdrawals.push({ nodeIndex, amount });
            if (node.kind === 'gold') {
                result.goldPerSecond += amount / stepSeconds;
                result.goldDeposits++;
            }
            else {
                result.woodPerSecond += amount / stepSeconds;
                result.woodDeposits++;
            }
        }
    return result;
}
