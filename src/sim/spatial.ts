import type { Point } from './types';

/** Stable source-order queries preserve equal-priority target decisions. Live
 * references may move after indexing if the caller supplies a displacement bound. */
export class SpatialIndex<T extends Point> {
    private readonly items: readonly T[];
    private readonly dense: boolean;
    private readonly buckets = new Map<string, { item: T; order: number }[]>();
    constructor(items: readonly T[], readonly cellSize = 8) {
        this.items = [...items];
        if (!Number.isFinite(cellSize) || cellSize <= 0) throw new RangeError('Spatial cell size must be positive.');
        items.forEach((item, order) => {
            if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) throw new RangeError('Spatial positions must be finite.');
            const key = this.key(Math.floor(item.x / cellSize), Math.floor(item.y / cellSize));
            const bucket = this.buckets.get(key) ?? [];
            bucket.push({ item, order }); this.buckets.set(key, bucket);
        });
        // In a crowded snapshot, scanning original order is cheaper than
        // sorting almost the whole army after every nearby query.
        this.dense = items.length >= 128 && this.buckets.size <= items.length / 24;
    }
    private key(x: number, y: number) { return `${x}:${y}`; }
    query(point: Point, radius: number, maximumDisplacement = 0): T[] {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(radius) || radius < 0 || !Number.isFinite(maximumDisplacement) || maximumDisplacement < 0) throw new RangeError('Spatial queries need finite positions and nonnegative radii.');
        const bounds = radius + maximumDisplacement, radiusSquared = radius * radius;
        const minX = Math.floor((point.x - bounds) / this.cellSize), maxX = Math.floor((point.x + bounds) / this.cellSize);
        const minY = Math.floor((point.y - bounds) / this.cellSize), maxY = Math.floor((point.y + bounds) / this.cellSize);
        if (this.dense || ![minX, maxX, minY, maxY].every(Number.isSafeInteger) || (maxX - minX + 1) * (maxY - minY + 1) > this.buckets.size * 2) {
            const squared = Number.isFinite(radiusSquared);
            return this.items.filter(item => { const dx = item.x - point.x, dy = item.y - point.y; return squared ? dx * dx + dy * dy <= radiusSquared : Math.hypot(dx, dy) <= radius; });
        }
        const candidates: { item: T; order: number }[] = [];
        const inspect = (entries: { item: T; order: number }[]) => {
            for (const entry of entries) {
                const dx = entry.item.x - point.x, dy = entry.item.y - point.y;
                if (Number.isFinite(radiusSquared) ? dx * dx + dy * dy <= radiusSquared : Math.hypot(dx, dy) <= radius) candidates.push(entry);
            }
        };
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) inspect(this.buckets.get(this.key(x, y)) ?? []);
        candidates.sort((a, b) => a.order - b.order);
        return candidates.map(entry => entry.item);
    }
}
