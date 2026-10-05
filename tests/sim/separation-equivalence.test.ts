import { describe, expect, it } from 'vitest';
import { createGame, spawnEntity, stepGame } from '../../src/sim/engine';
import { isWalkable, seededRandom } from '../../src/sim/maps';
import type { Entity, GameState, UnitId } from '../../src/sim/types';

/** Independent pre-optimization pair rule; deliberately evaluates every distance. */
function referenceSeparation(map: GameState['map'], entities: Entity[]) {
    for (let i = 0; i < entities.length; i++) {
        const a = entities[i];
        for (let j = i + 1; j < entities.length; j++) {
            const b = entities[j];
            let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
            const minimum = (a.radius + b.radius) * .8;
            if (d < .001) { dx = Math.cos((i + j) * 2.39996) * .001; dy = Math.sin((i + j) * 2.39996) * .001; d = .001; }
            if (d < minimum) {
                const push = (minimum - d) * .2, px = dx / d * push, py = dy / d * push;
                if (isWalkable(map, a.x - px, a.y - py)) { a.x -= px; a.y -= py; }
                if (isWalkable(map, b.x + px, b.y + py)) { b.x += px; b.y += py; }
            }
        }
    }
}

describe('separation optimization equivalence', () => {
    it('matches the original pair rule after every tick for overlapping, coincident, distant and terrain-edge units', () => {
        const state = createGame({ seed: 'SEPARATION-REFERENCE', mapSize: 'small' });
        state.players.forEach(player => player.ai = false);
        state.entities = []; state.map.nodes = []; state.navigationVersion++;
        state.map.tiles.fill('grass');
        for (let y = 0; y < state.map.height; y++) state.map.tiles[y * state.map.width + 24] = 'water';
        const random = seededRandom('PAIR-POSITIONS');
        const types: UnitId[] = ['swordsman', 'spearman', 'archer', 'cavalry', 'siege', 'support'];
        for (let n = 0; n < 90; n++) {
            const entity = spawnEntity(state, n % 2, 'unit', types[n % types.length], 20, 20);
            entity.x = n < 8 ? 20 : n < 70 ? 18 + random() * 6 : 2 + random() * 36;
            entity.y = n < 8 ? 20 : n < 70 ? 18 + random() * 6 : 2 + random() * 36;
            entity.damage = 0; entity.speed = 0; entity.order = { type: 'hold' };
        }
        const reference = structuredClone(state.entities);
        for (let tick = 1; tick <= 160; tick++) {
            if (tick % 2 === 0) referenceSeparation(state.map, reference);
            stepGame(state, .1);
            expect(state.entities.map(({ id, x, y }) => ({ id, x, y })), `tick ${tick}`).toEqual(reference.map(({ id, x, y }) => ({ id, x, y })));
        }
    });
});
