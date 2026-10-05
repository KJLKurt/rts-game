import type { GameMap, GameSettings, MapValidation, Point, TerrainType, ResourceNode } from './types';
import { BIOMES, MAP_DIMENSIONS } from './content';
import { validateMapStructure } from './validation';
import { defaultMatchSlots, validateScaleSettings } from './scales';
import type { MapNeutralCamp, MapScenario } from './scenario-types';
export function hashSeed(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0 || 1;
}
export function seededRandom(seed: string | number): () => number { let a = typeof seed === 'number' ? seed : hashSeed(seed); return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function tileIndex(map: GameMap, x: number, y: number): number { return Math.floor(y) * map.width + Math.floor(x); }
export function terrainAt(map: GameMap, x: number, y: number): TerrainType { return map.tiles[tileIndex(map, x, y)] ?? 'rock'; }
export function isWalkable(map: GameMap, x: number, y: number): boolean { return x >= 0 && y >= 0 && x < map.width && y < map.height && !['water', 'rock'].includes(terrainAt(map, x, y)); }
export function isBuildable(map: GameMap, x: number, y: number): boolean { return isWalkable(map, x, y) && terrainAt(map, x, y) !== 'marsh' && terrainAt(map, x, y) !== 'forest'; }
const emptyValidation = (): MapValidation => ({ valid: true, errors: [], warnings: [], reachablePercent: 1, fairness: 1 });
export function generateMap(settings: GameSettings): GameMap {
    const version = settings.mapGenerationVersion ?? 4;
    if (version !== 3 && version !== 4 && version !== 5)
        throw new Error('Unsupported map generation version. Choose version 3, 4 or 5.');
    const scaleErrors = validateScaleSettings(settings);
    if (scaleErrors.length) throw new Error(scaleErrors.join(' '));
    const width = MAP_DIMENSIONS[settings.mapSize], height = width, center = { x: width / 2 + .5, y: height / 2 + .5 };
    const rand = seededRandom(`${settings.seed}:v${version}:${settings.biome}:${settings.mapSize}:${settings.aiPlayers}:${settings.preset}`);
    const primary = BIOMES[settings.biome].primary;
    const map: GameMap = { version, seed: settings.seed, biome: settings.biome, width, height, tiles: Array(width * height).fill(primary), spawns: [], nodes: [], validation: emptyValidation() };
    const players = Math.min(6, Math.max(2, version === 5 && settings.slots ? settings.slots.length : settings.aiPlayers + 1));
    if (players === 2) {
        map.spawns = [{ x: 6.5, y: height / 2 + .5 }, { x: width - 6.5, y: height / 2 + .5 }];
    }
    else
        for (let i = 0; i < players; i++) {
            const a = Math.PI + i * Math.PI * 2 / players;
            map.spawns.push({ x: Math.floor(width / 2 + Math.cos(a) * (width / 2 - 7)) + .5, y: Math.floor(height / 2 + Math.sin(a) * (height / 2 - 7)) + .5 });
        }
    function paint(cx: number, cy: number, r: number, type: TerrainType) {
        for (let y = Math.max(1, Math.floor(cy - r)); y < Math.min(height - 1, cy + r + 1); y++)
            for (let x = Math.max(1, Math.floor(cx - r)); x < Math.min(width - 1, cx + r + 1); x++) {
                if (Math.hypot(x - cx, y - cy) <= r)
                    map.tiles[y * width + x] = type;
            }
    }
    const clusters = Math.floor(width * settings.terrainRoughness * .8 * (version === 5 ? width / 54 : 1));
    for (let n = 0; n < clusters; n++) {
        const x = Math.floor(3 + rand() * (width - 6)), y = Math.floor(3 + rand() * (height - 6)), r = 1 + rand() * 2.7;
        let type: TerrainType = rand() < settings.water ? 'water' : rand() < .18 ? 'rock' : 'forest';
        if (settings.biome === 'forest' && rand() < .35)
            type = 'forest';
        paint(x, y, r, type);
        if (settings.preset === 'competitive' || settings.preset === 'balanced')
            paint(width - 1 - x, height - 1 - y, r, type);
    }
    if (version === 5 && settings.weirdness > 0) {
        for (let i = 0; i < Math.ceil(width * settings.weirdness * .15); i++) {
            const x = 4 + rand() * (width - 8), y = 4 + rand() * (height - 8), r = 1.5 + rand() * 3;
            const type: TerrainType = rand() < .65 ? 'marsh' : settings.biome === 'snow' ? 'sand' : 'snow';
            paint(x, y, r, type);
            if (settings.preset === 'competitive' || settings.preset === 'balanced') paint(width - 1 - x, height - 1 - y, r, type);
        }
    }
    // Deterministic guaranteed corridors: keeps/resources/objectives never become isolated.
    function clear(p: Point, r: number) { paint(Math.floor(p.x), Math.floor(p.y), r, primary); }
    function road(a: Point, b: Point, widthRoad = 1.5) {
        const steps = Math.ceil(distance(a, b) * 2);
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            paint(Math.floor(a.x + (b.x - a.x) * t), Math.floor(a.y + (b.y - a.y) * t), widthRoad, 'road');
        }
    }
    clear(center, 5);
    map.spawns.forEach((s) => { clear(s, 6); road(s, center, 1.6); });
    for (let i = 0; i < players; i++)
        road(map.spawns[i], map.spawns[(i + 1) % players], 1.2);
    function node(p: Point, kind: ResourceNode['kind'], owner: number | null, amount: number) { clear(p, 2); map.nodes.push({ id: `node-${map.nodes.length}`, x: Math.floor(p.x) + .5, y: Math.floor(p.y) + .5, kind, owner, captureTeam: null, captureProgress: 0, radius: 2.2, income: kind === 'relic' ? 0 : kind === 'gold' ? 2.1 : 2.35, amount, maxAmount: amount }); }
    const resourceAmount = Math.round(1450 * Math.max(.3, settings.resourceAbundance) * (version === 5 ? Math.max(.55, settings.duration / 18) : Math.sqrt(settings.duration / 18)));
    map.spawns.forEach((s, i) => {
        const vx = (center.x - s.x) / distance(center, s), vy = (center.y - s.y) / distance(center, s), perp = { x: -vy, y: vx };
        node({ x: s.x + perp.x * 4, y: s.y + perp.y * 4 }, 'gold', i, resourceAmount);
        node({ x: s.x - perp.x * 4, y: s.y - perp.y * 4 }, 'wood', i, resourceAmount);
        const forward = { x: s.x + vx * 9, y: s.y + vy * 9 };
        node({ x: forward.x + perp.x * 4, y: forward.y + perp.y * 4 }, 'gold', null, resourceAmount * 1.2);
        node({ x: forward.x - perp.x * 4, y: forward.y - perp.y * 4 }, 'wood', null, resourceAmount * 1.2);
        road(s, forward, 1.5);
    });
    node(center, 'relic', null, 0);
    const relics = settings.objectiveDensity >= 1 ? 3 : 1;
    if (relics === 3) {
        if (version === 5 && players > 2) {
            // Equal approaches, unlike the legacy north/south objective line.
            for (const spawn of map.spawns) {
                const length = distance(spawn, center), radius = Math.min(11, width * .21, Math.min(...map.spawns.map(s => distance(s, center))) * .45);
                node({ x: center.x + (spawn.x - center.x) / length * radius, y: center.y + (spawn.y - center.y) / length * radius }, 'relic', null, 0);
            }
        }
        else {
            node({ x: center.x, y: center.y - Math.min(11, width * .21) }, 'relic', null, 0);
            node({ x: center.x, y: center.y + Math.min(11, width * .21) }, 'relic', null, 0);
        }
    }
    for (const n of map.nodes) {
        road(n, center, n.kind === 'relic' ? 1.2 : .7);
        clear(n, 2);
    }
    // Small neutral central reserves reward pushing beyond the safe starting deposits.
    if (width >= 42) {
        if (version === 3) {
            // Frozen legacy layout: explicit v3 seeds must remain reproducible.
            node({ x: center.x - 6, y: center.y - 7 }, 'gold', null, resourceAmount * 1.8);
            node({ x: center.x + 6, y: center.y + 7 }, 'wood', null, resourceAmount * 1.8);
        }
        else {
            // Both flanks receive the same kinds and quantities of central reserves.
            // The two-player start midpoint is (width/2, height/2+.5).
            const left = center.x - 6, right = width - left, top = center.y - 7, bottom = center.y + 7;
            for (const [x, y, kind] of [[left, top, 'gold'], [right, bottom, 'gold'], [left, bottom, 'wood'], [right, top, 'wood']] as [
                number,
                number,
                'gold' | 'wood'
            ][]) {
                road({ x, y }, center, 1.1);
                node({ x, y }, kind, null, resourceAmount * 1.8);
            }
        }
    }
    if (version === 5) {
        // Long frontiers need economic stepping stones rather than an empty march.
        for (const spawn of map.spawns) {
            const length = distance(spawn, center), vx = (center.x - spawn.x) / length, vy = (center.y - spawn.y) / length;
            for (let advance = 25; advance < length - 14; advance += 18) {
                for (const [side, kind] of [[-1, 'gold'], [1, 'wood']] as const) {
                    const point = { x: spawn.x + vx * advance - vy * side * 5, y: spawn.y + vy * advance + vx * side * 5 };
                    road(point, center, 1.1);
                    node(point, kind, null, resourceAmount * 1.4);
                }
            }
        }
        if (settings.objectiveDensity >= 1.5) {
            for (const side of [-1, 1]) {
                const point = players > 2 ? { x: center.x + side * 3, y: center.y + side * 3 } : { x: center.x + side * Math.min(18, width * .2), y: center.y };
                road(point, center, 1.2);
                node(point, 'relic', null, 0);
            }
        }
        const camps: MapNeutralCamp[] = [];
        const density = settings.neutralCamps ?? 0;
        if (density > 0) {
            const count = Math.min(12, Math.max(2, Math.round(players * density)));
            for (let i = 0; i < count; i++) {
                let point: Point | undefined;
                for (let attempt = 0; attempt < 24; attempt++) {
                    const angle = (i + .35) * Math.PI * 2 / count + attempt * Math.PI / 12;
                    const radius = Math.min(width * (.28 + Math.floor(attempt / 8) * .05), 32);
                    const candidate = { x: Math.floor(center.x + Math.cos(angle) * radius) + .5, y: Math.floor(center.y + Math.sin(angle) * radius) + .5 };
                    if (candidate.x < 4 || candidate.y < 4 || candidate.x > width - 4 || candidate.y > height - 4 || map.spawns.some(s => distance(s, candidate) < 17) || map.nodes.some(n => distance(n, candidate) < 5) || camps.some(c => distance(c, candidate) < 8)) continue;
                    point = candidate; break;
                }
                if (!point) continue;
                clear(point, 3); road(point, center, 1.1);
                camps.push({ id: `camp-${i}`, ...point, unit: i % 2 ? 'spearman' : 'swordsman', count: Math.min(5, 2 + Math.floor(density)), radius: 3, rewardGold: 70 + Math.round(density * 30), rewardWood: 55 + Math.round(density * 25) });
            }
        }
        const scenario: MapScenario = { version: 1, slots: settings.slots ? structuredClone(settings.slots) : defaultMatchSlots(settings), rules: { mode: settings.mode === 'rush' ? 'domination' : settings.mode, duration: settings.duration, populationCap: settings.populationCap, startingGold: settings.startingGold, startingWood: settings.startingWood, startingForces: 'standard', gameSpeed: settings.gameSpeed ?? 1, incomeRate: settings.incomeRate ?? 1 }, startingEntities: [], camps };
        map.scenario = scenario;
    }
    // Borders remain blocked for visual and navigation consistency.
    for (let x = 0; x < width; x++) {
        map.tiles[x] = 'rock';
        map.tiles[(height - 1) * width + x] = 'rock';
    }
    for (let y = 0; y < height; y++) {
        map.tiles[y * width] = 'rock';
        map.tiles[y * width + width - 1] = 'rock';
    }
    map.validation = validateMap(map, settings.preset === 'competitive');
    return map;
}
export function reachableTiles(map: GameMap, start: Point): Set<number> {
    const seen = new Set<number>();
    if (!isWalkable(map, start.x, start.y))
        return seen;
    const q = [tileIndex(map, start.x, start.y)];
    seen.add(q[0]);
    for (let h = 0; h < q.length; h++) {
        const p = q[h], x = p % map.width, y = Math.floor(p / map.width);
        for (const [dX, dY] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dX, ny = y + dY, idx = ny * map.width + nx;
            if (isWalkable(map, nx, ny) && !seen.has(idx)) {
                seen.add(idx);
                q.push(idx);
            }
        }
    }
    return seen;
}
export function validateMap(map: GameMap, competitive = false): MapValidation {
    const structuralErrors = validateMapStructure(map);
    if (structuralErrors.length) return { valid: false, errors: structuralErrors, warnings: [], reachablePercent: 0, fairness: 0 };
    const errors: string[] = [], warnings: string[] = [];
    if (!map || typeof map !== 'object' || !Array.isArray(map.tiles) || !Array.isArray(map.spawns) || !Array.isArray(map.nodes))
        return { valid: false, errors: ['Map must contain terrain, spawn locations, and resource points.'], warnings, reachablePercent: 0, fairness: 0 };
    if (map.spawns.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) || map.nodes.some(n => !n || typeof n.id !== 'string' || !['gold', 'wood', 'relic'].includes(n.kind) || !Number.isFinite(n.x) || !Number.isFinite(n.y)))
        return { valid: false, errors: ['Map has invalid spawn or resource point records.'], warnings, reachablePercent: 0, fairness: 0 };
    if (map.nodes.some(n => !Number.isFinite(n.amount) || n.amount < 0 || !Number.isFinite(n.maxAmount) || n.maxAmount < n.amount || !Number.isFinite(n.income) || n.income < 0 || !Number.isFinite(n.radius) || n.radius <= 0))
        return { valid: false, errors: ['Resource points need nonnegative finite amounts, income, and positive capture radii.'], warnings, reachablePercent: 0, fairness: 0 };
    if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 16 || map.height < 16 || map.width > 160 || map.height > 160)
        errors.push('Map dimensions must be whole numbers from 16 to 160.');
    if (map.tiles.length !== map.width * map.height)
        errors.push('Terrain count does not match map dimensions.');
    if (map.spawns.length < 2)
        errors.push('At least two spawn locations are required.');
    if (errors.length)
        return { valid: false, errors, warnings, reachablePercent: 0, fairness: 0 };
    const knownTerrains = ['grass', 'forest', 'water', 'rock', 'sand', 'snow', 'road', 'marsh'];
    if (map.tiles.some(t => !knownTerrains.includes(t)))
        errors.push('Map includes unknown terrain.');
    const reach = reachableTiles(map, map.spawns[0]);
    for (let i = 0; i < map.spawns.length; i++) {
        if (map.scenario?.slots[i]?.controller === 'closed') continue;
        const p = map.spawns[i];
        if (!isBuildable(map, p.x, p.y))
            errors.push(`Player ${i + 1} has an invalid spawn terrain.`);
        if (!reach.has(tileIndex(map, p.x, p.y)))
            errors.push(`Player ${i + 1} cannot reach the other players.`);
        for (const kind of map.purpose === 'arena' ? [] : ['gold', 'wood'])
            if (!map.nodes.some(n => n.kind === kind && distance(n, p) < 13 && reach.has(tileIndex(map, n.x, n.y))))
                errors.push(`Player ${i + 1} lacks reachable nearby ${kind}.`);
    }
    for (const n of map.nodes) {
        if (!isWalkable(map, n.x, n.y) || !reach.has(tileIndex(map, n.x, n.y)))
            errors.push(`${n.kind} deposit ${n.id} is unreachable.`);
        if (n.owner !== null && (n.owner < 0 || n.owner >= map.spawns.length))
            errors.push(`${n.id} has an invalid owner.`);
    }
    if (map.purpose !== 'arena' && !map.nodes.some(n => n.kind === 'relic'))
        errors.push('Map needs a relic objective.');
    if (map.purpose !== 'arena' && !map.nodes.some(n => n.kind !== 'relic' && n.owner === null))
        warnings.push('There are no neutral economic expansion locations.');
    const available = map.tiles.filter(t => t !== 'water' && t !== 'rock').length;
    const distances = map.spawns.filter((_, i) => map.scenario?.slots[i]?.controller !== 'closed').map(s => Math.min(...map.nodes.filter(n => n.kind === 'relic').map(n => distance(n, s))));
    const fairness = Math.min(...distances) / Math.max(...distances);
    if (map.purpose !== 'arena' && competitive && fairness < .75)
        errors.push('Competitive objective distances are too uneven.');
    return { valid: errors.length === 0, errors, warnings, reachablePercent: reach.size / Math.max(1, available), fairness: Number.isFinite(fairness) ? fairness : 0 };
}
const PATH_DIRECTIONS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
] as const;
// Map-owned buffers are collected with the map; searches never cache terrain across calls.
const pathWorkspace = new WeakMap<
    GameMap,
    {
        scores: Float64Array;
        heuristics: Float64Array;
        walkSeen: Uint32Array;
        walkable: Uint8Array;
        seen: Uint32Array;
        closed: Uint32Array;
        came: Int32Array;
        epoch: number;
        heapIds: Int32Array;
        heapScores: Float64Array;
    }
>();
/** Reuse scratch storage; all semantic caches expire at the end of each search.
 * Neighbor order, heap ties, costs and visited limits remain legacy-compatible. */
export function findPath(map: GameMap, start: Point, goal: Point, blocked?: Set<number>): Point[] {
    // Preserve behavior for unusual exported-API inputs outside the supported map bounds.
    const size = map.width * map.height;
    if (
        !Number.isFinite(start.x) ||
        !Number.isFinite(start.y) ||
        !Number.isFinite(goal.x) ||
        !Number.isFinite(goal.y) ||
        !Number.isInteger(map.width) ||
        !Number.isInteger(map.height) ||
        size > 25600 ||
        size < 1 ||
        start.x < 0 ||
        start.y < 0 ||
        start.x >= map.width ||
        start.y >= map.height
    )
        return findPathLegacy(map, start, goal, blocked);
    let workspace = pathWorkspace.get(map);
    if (!workspace || workspace.scores.length !== size) {
        workspace = {
            scores: new Float64Array(size),
            heuristics: new Float64Array(size),
            walkSeen: new Uint32Array(size),
            walkable: new Uint8Array(size),
            seen: new Uint32Array(size),
            closed: new Uint32Array(size),
            came: new Int32Array(size),
            epoch: 0,
            heapIds: new Int32Array(128),
            heapScores: new Float64Array(128),
        };
        pathWorkspace.set(map, workspace);
    }
    if (workspace.epoch === 0xffffffff) {
        workspace.seen.fill(0);
        workspace.closed.fill(0);
        workspace.walkSeen.fill(0);
        workspace.epoch = 0;
    }
    const epoch = ++workspace.epoch,
        { scores, seen, closed, came, heuristics, walkSeen, walkable } = workspace;
    const sx = Math.floor(start.x),
        sy = Math.floor(start.y);
    let gx = Math.floor(goal.x),
        gy = Math.floor(goal.y);
    const walk = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
        const id = y * map.width + x;
        // This cache includes this search's start-cell blocker exception.
        if (walkSeen[id] === epoch) return walkable[id] === 1;
        const terrain = map.tiles[id] ?? 'rock',
            answer =
                terrain !== 'water' && terrain !== 'rock' && (!blocked?.has(id) || (x === sx && y === sy));
        walkSeen[id] = epoch;
        walkable[id] = answer ? 1 : 0;
        return answer;
    };
    if (!walk(gx, gy)) {
        let found = false;
        for (let r = 1; r <= 6 && !found; r++) {
            let best: {
                x: number;
                y: number;
                d: number;
            } | null = null;
            for (let dy = -r; dy <= r; dy++)
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    if (walk(gx + dx, gy + dy)) {
                        const d = Math.hypot(gx + dx - start.x, gy + dy - start.y);
                        if (!best || d < best.d) best = { x: gx + dx, y: gy + dy, d };
                    }
                }
            if (best) {
                gx = best.x;
                gy = best.y;
                found = true;
            }
        }
        if (!found) return [];
    }
    const first = sy * map.width + sx,
        last = gy * map.width + gx;
    if (first === last) return [{ x: gx + 0.5, y: gy + 0.5 }];
    scores[first] = 0;
    seen[first] = epoch;
    // Preserve the legacy heap's exact strict/non-strict tie rules.
    let heapIds = workspace.heapIds,
        heapScores = workspace.heapScores,
        heapLength = 0;
    function push(id: number, f: number) {
        if (heapLength === heapIds.length) {
            const ids = new Int32Array(heapLength * 2),
                fs = new Float64Array(heapLength * 2);
            ids.set(heapIds);
            fs.set(heapScores);
            heapIds = workspace!.heapIds = ids;
            heapScores = workspace!.heapScores = fs;
        }
        let i = heapLength++;
        heapIds[i] = id;
        heapScores[i] = f;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heapScores[p] <= f) break;
            const parentId = heapIds[p],
                parentScore = heapScores[p];
            heapIds[p] = heapIds[i];
            heapScores[p] = heapScores[i];
            heapIds[i] = parentId;
            heapScores[i] = parentScore;
            i = p;
        }
    }
    function pop() {
        const top = heapIds[0];
        --heapLength;
        if (heapLength) {
            heapIds[0] = heapIds[heapLength];
            heapScores[0] = heapScores[heapLength];
            let i = 0;
            while (true) {
                let c = i * 2 + 1;
                if (c >= heapLength) break;
                if (c + 1 < heapLength && heapScores[c + 1] < heapScores[c]) c++;
                if (heapScores[i] <= heapScores[c]) break;
                const childId = heapIds[c],
                    childScore = heapScores[c];
                heapIds[c] = heapIds[i];
                heapScores[c] = heapScores[i];
                heapIds[i] = childId;
                heapScores[i] = childScore;
                i = c;
            }
        }
        return top;
    }
    push(first, Math.hypot(gx - sx, gy - sy));
    let visited = 0;
    while (heapLength && visited++ < map.width * map.height) {
        const id = pop();
        if (closed[id] === epoch) continue;
        if (id === last) {
            const path: Point[] = [];
            let cur = last;
            while (cur !== first) {
                path.push({ x: (cur % map.width) + 0.5, y: Math.floor(cur / map.width) + 0.5 });
                cur = came[cur];
            }
            return path.reverse();
        }
        closed[id] = epoch;
        const x = id % map.width,
            y = Math.floor(id / map.width);
        for (const [dx, dy] of PATH_DIRECTIONS) {
            const nx = x + dx,
                ny = y + dy,
                nid = ny * map.width + nx;
            if (!walk(nx, ny) || closed[nid] === epoch) continue;
            if (dx && dy && (!walk(x + dx, y) || !walk(x, y + dy))) continue;
            const terrain = map.tiles[nid],
                cost = (dx && dy ? 1.4142 : 1) * (terrain === 'forest' ? 1.3 : terrain === 'marsh' ? 1.6 : 1),
                g = scores[id] + cost;
            if (g < (seen[nid] === epoch ? scores[nid] : Infinity)) {
                if (seen[nid] !== epoch) heuristics[nid] = Math.hypot(gx - nx, gy - ny);
                scores[nid] = g;
                seen[nid] = epoch;
                came[nid] = id;
                push(nid, g + heuristics[nid]);
            }
        }
    }
    return [];
}

// Compatibility fallback for out-of-map starts and unusual map shapes.
function findPathLegacy(map: GameMap, start: Point, goal: Point, blocked?: Set<number>): Point[] {
    const sx = Math.floor(start.x), sy = Math.floor(start.y);
    let gx = Math.floor(goal.x), gy = Math.floor(goal.y);
    const walk = (x: number, y: number) => isWalkable(map, x, y) && (!blocked?.has(y * map.width + x) || (x === sx && y === sy));
    if (!walk(gx, gy)) {
        let found = false;
        for (let r = 1; r <= 6 && !found; r++) {
            let best: {
                x: number;
                y: number;
                d: number;
            } | null = null;
            for (let dy = -r; dy <= r; dy++)
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r)
                        continue;
                    if (walk(gx + dx, gy + dy)) {
                        const d = Math.hypot(gx + dx - start.x, gy + dy - start.y);
                        if (!best || d < best.d)
                            best = { x: gx + dx, y: gy + dy, d };
                    }
                }
            if (best) {
                gx = best.x;
                gy = best.y;
                found = true;
            }
        }
        if (!found)
            return [];
    }
    const first = sy * map.width + sx, last = gy * map.width + gx;
    if (first === last)
        return [{ x: gx + .5, y: gy + .5 }];
    const scores = new Map<number, number>([[first, 0]]), came = new Map<number, number>(), closed = new Set<number>();
    // Small binary heap avoids an O(n) minimum scan for large maps.
    const heap: {
        id: number;
        f: number;
    }[] = [];
    function push(id: number, f: number) {
        heap.push({ id, f });
        let i = heap.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heap[p].f <= f)
                break;
            [heap[p], heap[i]] = [heap[i], heap[p]];
            i = p;
        }
    }
    function pop() {
        const top = heap[0], tail = heap.pop()!;
        if (heap.length) {
            heap[0] = tail;
            let i = 0;
            while (true) {
                let c = i * 2 + 1;
                if (c >= heap.length)
                    break;
                if (c + 1 < heap.length && heap[c + 1].f < heap[c].f)
                    c++;
                if (heap[i].f <= heap[c].f)
                    break;
                [heap[i], heap[c]] = [heap[c], heap[i]];
                i = c;
            }
        }
        return top.id;
    }
    push(first, Math.hypot(gx - sx, gy - sy));
    let visited = 0;
    while (heap.length && visited++ < map.width * map.height) {
        const id = pop();
        if (closed.has(id))
            continue;
        if (id === last) {
            const path: Point[] = [];
            let cur = last;
            while (cur !== first) {
                path.push({ x: cur % map.width + .5, y: Math.floor(cur / map.width) + .5 });
                cur = came.get(cur)!;
            }
            return path.reverse();
        }
        closed.add(id);
        const x = id % map.width, y = Math.floor(id / map.width);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const nx = x + dx, ny = y + dy, nid = ny * map.width + nx;
            if (!walk(nx, ny) || closed.has(nid))
                continue;
            if (dx && dy && (!walk(x + dx, y) || !walk(x, y + dy)))
                continue;
            const terrain = map.tiles[nid], cost = (dx && dy ? 1.4142 : 1) * (terrain === 'forest' ? 1.3 : terrain === 'marsh' ? 1.6 : 1), g = scores.get(id)! + cost;
            if (g < (scores.get(nid) ?? Infinity)) {
                scores.set(nid, g);
                came.set(nid, id);
                push(nid, g + Math.hypot(gx - nx, gy - ny));
            }
        }
    }
    return [];
}
