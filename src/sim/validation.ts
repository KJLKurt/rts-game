import { BIOMES, UNITS } from './content';

export const MAX_MAP_JSON_BYTES = 2 * 1024 * 1024;
export const MAX_SAVE_JSON_BYTES = 16 * 1024 * 1024;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown, minimum = 0, maximum = Infinity): value is number => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
const nonempty = (value: unknown, maximum = 128): value is string => typeof value === 'string' && value.length <= maximum && value.trim().length > 0;
const fields = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));

/** Inspect plain data iteratively: never execute accessors or recurse on imported objects. */
export function validateDataSafety(input: unknown, maximumValues = 1_000_000): string[] {
    const pending: { value: unknown; depth: number; exit?: boolean }[] = [{ value: input, depth: 0 }];
    const ancestors = new WeakSet<object>();
    let visited = 0;
    while (pending.length) {
        const { value, depth, exit } = pending.pop()!;
        if (exit) {
            ancestors.delete(value as object);
            continue;
        }
        if (++visited > maximumValues)
            return ['Data contains too many values.'];
        if (depth > 24)
            return ['Data nesting exceeds the supported depth.'];
        if (value === null || typeof value === 'string' || typeof value === 'boolean')
            continue;
        if (typeof value === 'number') {
            if (!Number.isFinite(value))
                return ['Data contains a nonfinite number.'];
            continue;
        }
        if (typeof value !== 'object')
            return ['Only plain JSON data is supported.'];
        const prototype = Object.getPrototypeOf(value);
        if (Array.isArray(value) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
            return ['Only plain JSON objects and arrays are supported.'];
        if (ancestors.has(value))
            return ['Data contains a circular reference.'];
        const keys = Reflect.ownKeys(value);
        if (visited + pending.length + keys.length > maximumValues)
            return ['Data contains too many values.'];
        ancestors.add(value);
        pending.push({ value, depth, exit: true });
        for (const key of keys) {
            if (typeof key !== 'string' || FORBIDDEN_KEYS.has(key))
                return ['Data contains a forbidden property key.'];
            if (Array.isArray(value) && key === 'length')
                continue;
            const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
            if (!('value' in descriptor))
                return ['Data accessors are not supported.'];
            pending.push({ value: descriptor.value, depth: depth + 1 });
        }
    }
    return [];
}

/** Check size before JSON.parse, then reject unsafe keys and excessive nesting/work. */
export function parseBoundedJSON(text: string, maximumBytes = MAX_SAVE_JSON_BYTES): unknown {
    if (typeof text !== 'string' || !Number.isInteger(maximumBytes) || maximumBytes < 1
        || text.length > maximumBytes || new TextEncoder().encode(text).byteLength > maximumBytes)
        throw new Error('JSON data exceeds the supported size limit.');
    const data: unknown = JSON.parse(text);
    const errors = validateDataSafety(data);
    if (errors.length)
        throw new Error(errors[0]);
    return data;
}

/** Bounded structural checks run before pathfinding, allocation, or editor rendering. */
export function validateMapStructure(input: unknown): string[] {
    const safety = validateDataSafety(input, 100_000);
    if (safety.length)
        return safety;
    if (!record(input) || !fields(input, ['version', 'seed', 'name', 'biome', 'width', 'height', 'tiles', 'spawns', 'nodes', 'purpose', 'validation']))
        return ['Map contains an unsupported structure or field.'];
    const map = input;
    if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || !finite(map.width, 16, 160) || !finite(map.height, 16, 160))
        return ['Map dimensions must be whole numbers from 16 to 160.'];
    if (!Array.isArray(map.tiles) || map.tiles.length !== map.width * map.height)
        return ['Terrain count does not match map dimensions.'];
    if (!Array.isArray(map.spawns) || map.spawns.length < 2 || map.spawns.length > 6)
        return ['Map must contain between two and six spawn locations.'];
    if (!Array.isArray(map.nodes) || map.nodes.length > 512)
        return ['Map must contain at most 512 resource points.'];
    if (![3, 4].includes(map.version as number) || !nonempty(map.seed, 80)
        || (map.name !== undefined && !nonempty(map.name, 120))
        || typeof map.biome !== 'string' || !Object.hasOwn(BIOMES, map.biome)
        || (map.purpose !== undefined && map.purpose !== 'arena'))
        return ['Map has an invalid version, name, seed, biome, or purpose.'];
    const point = (value: unknown): value is Record<string, unknown> => record(value)
        && finite(value.x, 0, map.width as number) && finite(value.y, 0, map.height as number)
        && value.x < (map.width as number) && value.y < (map.height as number);
    if (map.tiles.some(tile => typeof tile !== 'string' || !['grass', 'forest', 'water', 'rock', 'sand', 'snow', 'road', 'marsh'].includes(tile)))
        return ['Map includes unknown terrain.'];
    if (map.spawns.some(spawn => !point(spawn) || !fields(spawn, ['x', 'y'])))
        return ['Map has invalid spawn coordinates or fields.'];
    const ids = new Set<string>();
    const team = (value: unknown) => value === null || Number.isInteger(value) && finite(value, 0, (map.spawns as unknown[]).length - 1);
    for (const node of map.nodes) {
        if (!point(node) || !fields(node, ['id', 'x', 'y', 'kind', 'owner', 'captureTeam', 'captureProgress', 'radius', 'income', 'amount', 'maxAmount'])
            || !nonempty(node.id) || ids.has(node.id) || !['gold', 'wood', 'relic'].includes(node.kind as string)
            || !team(node.owner) || !team(node.captureTeam) || !finite(node.captureProgress, 0, 1)
            || !finite(node.radius, .1, 20) || !finite(node.income, 0, 100)
            || !finite(node.amount, 0, 1_000_000_000) || !finite(node.maxAmount, node.amount as number, 1_000_000_000))
            return ['Resource points contain invalid IDs, coordinates, ownership, amounts, or fields.'];
        ids.add(node.id);
    }
    return [];
}

export interface TriggerValidationOptions {
    teamCount?: number;
    width?: number;
    height?: number;
}
/** Validate strictly declarative campaign data before accepting content or resuming a save. */
export function validateTriggers(input: unknown, options: TriggerValidationOptions = {}): string[] {
    const safety = validateDataSafety(input, 20_000);
    if (safety.length)
        return safety;
    if (!Array.isArray(input) || input.length > 128)
        return ['Mission triggers must be an array of at most 128 triggers.'];
    const errors: string[] = [], ids = new Set<string>();
    const teamCount = options.teamCount ?? 6;
    if (!Number.isInteger(teamCount) || !finite(teamCount, 1, 6)
        || (options.width !== undefined && !finite(options.width, 1, 160))
        || (options.height !== undefined && !finite(options.height, 1, 160)))
        return ['Mission trigger validation bounds are invalid.'];
    const team = (value: unknown) => Number.isInteger(value) && finite(value, 0, teamCount - 1);
    const point = (value: Record<string, unknown>) => finite(value.x) && finite(value.y)
        && value.x < (options.width ?? 160) && value.y < (options.height ?? 160);
    let totalActions = 0, totalSpawns = 0;
    input.forEach((trigger, index) => {
        const label = record(trigger) && nonempty(trigger.id) ? trigger.id : `trigger ${index + 1}`;
        if (!record(trigger) || !fields(trigger, ['id', 'when', 'actions', 'fired'])) {
            errors.push(`${label}: expected a declarative trigger object without unsupported fields.`);
            return;
        }
        if (!nonempty(trigger.id) || ids.has(trigger.id))
            errors.push(`${label}: missing or duplicate trigger ID.`);
        else
            ids.add(trigger.id);
        if (trigger.fired !== undefined && typeof trigger.fired !== 'boolean')
            errors.push(`${label}: fired must be a boolean.`);
        const when = trigger.when;
        if (!record(when))
            errors.push(`${label}: missing trigger condition.`);
        else {
            let valid = false;
            switch (when.type) {
                case 'time':
                    valid = fields(when, ['type', 'seconds']) && finite(when.seconds);
                    break;
                case 'captured':
                    valid = fields(when, ['type', 'team', 'nodeId']) && team(when.team) && nonempty(when.nodeId);
                    break;
                case 'resource':
                    valid = fields(when, ['type', 'team', 'resource', 'amount']) && team(when.team)
                        && typeof when.resource === 'string' && ['gold', 'wood'].includes(when.resource) && finite(when.amount, 0, 1_000_000_000);
                    break;
                case 'destroyed':
                    valid = fields(when, ['type', 'entityId']) && nonempty(when.entityId);
                    break;
                case 'region':
                    valid = fields(when, ['type', 'team', 'x', 'y', 'radius']) && team(when.team) && point(when) && finite(when.radius, .001, 160);
                    break;
            }
            if (!valid)
                errors.push(`${label}: unknown or invalid trigger condition.`);
        }
        if (!Array.isArray(trigger.actions) || trigger.actions.length === 0 || trigger.actions.length > 32) {
            errors.push(`${label}: between one and 32 actions are required.`);
            return;
        }
        totalActions += trigger.actions.length;
        trigger.actions.forEach((action, actionIndex) => {
            let valid = false;
            if (record(action))
                switch (action.type) {
                    case 'dialogue':
                        valid = fields(action, ['type', 'text', 'team']) && nonempty(action.text, 4000) && (action.team === undefined || team(action.team));
                        break;
                    case 'resources':
                        valid = fields(action, ['type', 'team', 'gold', 'wood']) && team(action.team) && finite(action.gold, 0, 1_000_000_000) && finite(action.wood, 0, 1_000_000_000);
                        break;
                    case 'spawn':
                        valid = fields(action, ['type', 'team', 'unit', 'count', 'x', 'y']) && team(action.team) && typeof action.unit === 'string'
                            && Object.hasOwn(UNITS, action.unit)
                            && Number.isInteger(action.count) && finite(action.count, 1, 1000) && point(action);
                        if (valid)
                            totalSpawns += action.count as number;
                        break;
                    case 'victory':
                    case 'reveal':
                        valid = fields(action, ['type', 'team']) && team(action.team);
                        break;
                    case 'objective':
                        valid = fields(action, ['type', 'text']) && nonempty(action.text, 4000);
                        break;
                }
            if (!valid)
                errors.push(`${label}: action ${actionIndex + 1} has invalid data, content IDs, team, or unsupported fields.`);
        });
    });
    if (totalActions > 512 || totalSpawns > 2000)
        errors.push('Mission exceeds the supported action or spawned-unit budget.');
    return errors;
}
