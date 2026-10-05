import { describe, expect, it } from 'vitest';
import { SpatialIndex } from '../../src/sim/spatial';
import { seededRandom } from '../../src/sim/maps';

describe('deterministic spatial queries', () => {
    it('matches full scans in source order across 450 queries and exact cell boundaries', () => {
        const random = seededRandom('SPATIAL-CORRECTNESS');
        const items = Array.from({ length: 1200 }, (_, id) => ({ id, x: random() * 180 - 10, y: random() * 180 - 10 }));
        for (const cellSize of [4, 8, 16]) {
            const index = new SpatialIndex(items, cellSize);
            for (let n = 0; n < 150; n++) {
                const center = { x: random() * 180 - 10, y: random() * 180 - 10 }, radius = random() * 22;
                expect(index.query(center, radius)).toEqual(items.filter(item => (item.x - center.x) ** 2 + (item.y - center.y) ** 2 <= radius * radius));
            }
        }
        const edge = [{ x: -8, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 8 }, { x: 0, y: -8 }];
        expect(new SpatialIndex(edge).query({ x: 0, y: 0 }, 8)).toEqual(edge);
    });
    it('includes bounded movement across cells while retaining tie order', () => {
        const objects = [{ id: 'first', x: 8.1, y: 0 }, { id: 'second', x: 0, y: .1 }, { id: 'third', x: -8.1, y: 0 }];
        const index = new SpatialIndex(objects); objects[0].x = 7.9; objects[2].x = -7.9;
        expect(index.query({ x: 0, y: 0 }, 8, .2)).toEqual(objects);
        objects[1].y = 9; expect(index.query({ x: 0, y: 0 }, 8, 9)).toEqual([objects[0], objects[2]]);
    });
    it('preserves frozen source objects and rejects nonfinite query inputs', () => {
        const object = Object.freeze({ x: 1, y: 1 }), index = new SpatialIndex([object]);
        expect(index.query(object, 0)).toEqual([object]);
        expect(() => index.query(object, Infinity)).toThrow(); expect(() => new SpatialIndex([object], 0)).toThrow();
    });
    it('bounds huge finite imported radii and movement without overflow errors', () => {
        const points = [{ x: 1, y: 1 }, { x: 150, y: 150 }, { x: -100, y: 0 }], index = new SpatialIndex(points);
        expect(index.query({ x: 0, y: 0 }, 1e12, 1e12)).toEqual(points);
        expect(index.query({ x: 0, y: 0 }, Number.MAX_VALUE, Number.MAX_VALUE)).toEqual(points);
        expect(index.query({ x: 0, y: 0 }, 2, 1e12)).toEqual([points[0]]);
        expect(index.query({ x: Number.MAX_VALUE, y: 0 }, 0)).toEqual([]);
        expect(index.query({ x: 1e300, y: 0 }, 1e200)).toEqual([]);
    });
    it('retains source order and snapshot membership for dense live-position queries', () => {
        const random = seededRandom('DENSE-SPATIAL-REGRESSION');
        const items = Array.from({ length: 600 }, (_, id) => ({ id, x: 75 + random() * 10, y: 75 + random() * 10 }));
        const snapshot = [...items], index = new SpatialIndex(items);
        // Changing the input array must not add members to the indexed snapshot.
        items.push({ id: 9999, x: 80, y: 80 });
        for (let n = 0; n < 100; n++) {
            const point = { x: 73 + random() * 14, y: 73 + random() * 14 }, radius = random() * 9;
            expect(index.query(point, radius)).toEqual(snapshot.filter(item => (item.x - point.x) ** 2 + (item.y - point.y) ** 2 <= radius * radius));
        }
        snapshot.forEach(item => { item.x += .4; item.y -= .4; });
        const point = { x: 80, y: 80 }, radius = 5;
        expect(index.query(point, radius, .6)).toEqual(snapshot.filter(item => (item.x - point.x) ** 2 + (item.y - point.y) ** 2 <= radius * radius));
    });
});
