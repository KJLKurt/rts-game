import { areAllied, areHostile, allianceRepresentative, allianceMembers, isCompetitivePlayer } from './alliances';
import { evaluateScriptCondition } from './triggers';
import { SpatialIndex } from './spatial';
import { validateMapPlayerSlots, validateMapScenario, validateScenarioGeometry } from './scenarios';
import { validateScaleSettings, dominationScoreTarget } from './scales';
import { footprintsOverlap } from './construction';
import { PRODUCTION_QUEUE_LIMIT, buildingLevel, buildingPopulation, nextBuildingUpgrade, productionRate, productionRefund, technologyCost, queueItemCost } from './progression';
import { getEconomyRates } from './economy';
import { validateTriggers, validateGameModifiers, parseBoundedJSON, MAX_SAVE_JSON_BYTES, MAX_MAP_JSON_BYTES } from './validation';
import type { GameMap, GameState, GameSettings, GameCommand, CommandResult, Entity, Point, Player, PlayerStats, UnitId, BuildingId, TechId, GameEvent, CommanderId, ScriptAction, RushUpgradeId } from './types';
import { DEFAULT_SETTINGS, UNITS, BUILDINGS, COMMANDERS, FACTIONS, TECHNOLOGIES, BIOMES, FIXED_STEP, TEAM_COLORS, TEAM_SYMBOLS, MAP_DIMENSIONS, RUSH_UPGRADES } from './content';
import { generateMap, validateMap, hashSeed, distance, isWalkable, isBuildable, terrainAt, tileIndex, findPath } from './maps';
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const IDLE_GUARD_RADIUS = 2;
const ACTIVE_GUARD_RADIUS = 6;
const ACTIVE_ATTACKER_RADIUS = 7.5;
const GUARD_CLUSTER_RADIUS = 3;
const GUARD_DAMAGE_MEMORY = 2.5;
const EASY_OPENING_SECONDS = 60;
const knownId = (definitions: object, id: unknown) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(definitions, id);
const direction = (a: Point, b: Point): Point => { const d = distance(a, b); return d > .001 ? { x: (b.x - a.x) / d, y: (b.y - a.y) / d } : { x: 1, y: 0 }; };
const living = (e: Entity) => e.hp > 0;
const active = (e: Entity) => e.hp > 0 && e.buildProgress >= 1;
const stats = (): PlayerStats => ({ unitsCreated: 0, unitsLost: 0, kills: 0, buildingsCreated: 0, buildingsDestroyed: 0, goldCollected: 0, woodCollected: 0, captures: 0, commanderDeaths: 0, damageDealt: 0, pauses: 0 });
function random(state: GameState) { let x = state.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; state.rng = x >>> 0; return state.rng / 4294967296; }
function emit(s: GameState, event: Omit<GameEvent, 'id' | 'time'>) { s.events.push({ ...event, id: s.nextEventId++, time: s.time }); }
export function createGame(partial: Partial<GameSettings> = {}): GameState {
    const settings: GameSettings = { ...DEFAULT_SETTINGS, ...partial };
    if (settings.mode === 'rush') {
        settings.duration = 4;
        settings.aiPlayers = 1;
        settings.mapSize = 'small';
        settings.neutralCamps = 0;
        delete settings.slots; delete settings.customMap;
    }
    if (settings.learning) settings.neutralCamps = 0;
    if (settings.scriptedVictory !== undefined && typeof settings.scriptedVictory !== 'boolean') throw new Error('Scripted victory must be a boolean.');
    settings.aiPlayers = clamp(Math.floor(settings.aiPlayers), 1, 5);
    settings.duration = clamp(settings.duration, 4, 180);
    settings.populationCap = clamp(settings.populationCap, 12, 200);
    if (!knownId(BIOMES, settings.biome) || !knownId(FACTIONS, settings.faction) || !knownId(COMMANDERS, settings.commander))
        throw new Error('Unknown biome, faction or commander.');
    const initialErrors = [...validateScaleSettings(settings), ...validateGameModifiers(settings.modifiers), ...(settings.slots ? validateMapPlayerSlots(settings.slots) : [])];
    if (initialErrors.length) throw new Error(initialErrors.join(' '));
    if (settings.slots) settings.aiPlayers = settings.slots.length - 1;
    const map: GameMap = settings.customMap ? parseBoundedJSON(JSON.stringify(settings.customMap), MAX_MAP_JSON_BYTES) as GameMap : generateMap(settings);
    if (settings.mode === 'rush') delete map.scenario;
    if (settings.customMap && (map.version === 3 || map.version === 4 || map.version === 5))
        settings.mapGenerationVersion = map.version;
    map.validation = validateMap(map, settings.preset === 'competitive');
    if (!map.validation.valid)
        throw new Error(`Invalid map: ${map.validation.errors.join(' ')}`);
    if (map.scenario) {
        const errors = [...validateMapScenario(map.scenario, map.width, map.height, map.spawns.length), ...validateScenarioGeometry(map)];
        if (errors.length) throw new Error(`Invalid scenario: ${errors.join(' ')}`);
        const { startingForces: _forces, scoreTarget: _target, ...rules } = map.scenario.rules;
        Object.assign(settings, rules, { slots: structuredClone(map.scenario.slots), aiPlayers: map.scenario.slots.length - 1 });
    }
    const finalErrors = [...validateScaleSettings(settings), ...validateGameModifiers(settings.modifiers, map.spawns.length)];
    if (finalErrors.length) throw new Error(finalErrors.join(' '));
    if (settings.slots && settings.slots.length !== map.spawns.length) throw new Error('Player slots must match map spawns.');
    if (settings.slots) Object.assign(settings, { commander: settings.slots[0].commander, faction: settings.slots[0].faction, difficulty: settings.slots[0].difficulty });
    const state: GameState = { version: 1, settings, map, entities: [], players: [], time: 0, tick: 0, accumulator: 0, winner: null, victoryReason: '', paused: false, pendingCommands: [], events: [], fog: { visible: [], explored: [] }, nextId: 1, nextEventId: 1, rng: hashSeed(settings.seed + ':simulation'), scoreTarget: map.scenario?.rules.scoreTarget ?? (map.version === 5 ? dominationScoreTarget(settings, map.nodes.filter(n => n.kind === 'relic').length) : Math.round(settings.duration * 80)), escalation: 1, objectiveText: settings.mode === 'conquest' ? 'Destroy enemy keeps. Held relics fund your siege; supplies grow with escalation.' : 'Capture relics to earn victory points, or destroy enemy keeps.', triggers: [], commandLog: [], lastFogTick: -10, navigationVersion: 0 };
    const factions = ['ironhold', 'wildborn', 'arcanists'] as const, commanders = ['warlord', 'ranger', 'engineer'] as const;
    map.spawns.forEach((spawn, team) => {
        const slot = settings.slots?.[team], bonuses = settings.modifiers?.players?.[team];
        const p: Player = { team, name: team === 0 ? 'You' : `Rival ${team}`, faction: team === 0 ? settings.faction : factions[team % 3], commander: team === 0 ? settings.commander : commanders[team % 3], color: TEAM_COLORS[team], symbol: TEAM_SYMBOLS[team], gold: settings.startingGold, wood: settings.startingWood, population: 0, populationCap: 12, maxPopulation: settings.populationCap, research: {}, score: 0, defeated: false, ai: team > 0 || settings.aiControlPlayer, personality: settings.aiPersonality, stats: stats(), aiNextThink: 1 + team * .2, aiPhase: 'Establishing a foothold', lastKnownEnemies: [] };
        if (slot) Object.assign(p, { name: slot.name, faction: slot.faction, commander: slot.commander, alliance: slot.alliance, difficulty: slot.difficulty, personality: slot.personality, ai: slot.controller === 'ai' || slot.controller === 'human' && team === 0 && settings.aiControlPlayer, closed: slot.controller === 'closed', defeated: slot.controller === 'closed' });
        p.gold += bonuses?.startingGold ?? 0; p.wood += bonuses?.startingWood ?? 0;
        state.players.push(p);
        state.fog.visible.push(Array(map.width * map.height).fill(0));
        state.fog.explored.push(Array(map.width * map.height).fill(0));
        if (p.closed || map.scenario?.rules.startingForces === 'authored') return;
        spawnEntity(state, team, 'building', 'keep', spawn.x, spawn.y, true);
        const inward = direction(spawn, { x: map.width / 2 + .5, y: map.height / 2 + .5 }), side = { x: -inward.y, y: inward.x };
        spawnEntity(state, team, 'building', 'barracks', spawn.x - inward.x * 3 + side.x * 3, spawn.y - inward.y * 3 + side.y * 3, true);
        spawnEntity(state, team, 'commander', p.commander, spawn.x + inward.x * 3, spawn.y + inward.y * 3, true);
        ['swordsman', 'swordsman', 'spearman', 'archer'].forEach((id, i) => spawnEntity(state, team, 'unit', id as UnitId, spawn.x + inward.x * (3 + (i % 2)) - side.x * (1.7 + Math.floor(i / 2) * .9), spawn.y + inward.y * (3 + (i % 2)) - side.y * (1.7 + Math.floor(i / 2) * .9), true));
    });
    for (const node of map.nodes) {
        if (node.owner !== null && state.players[node.owner]?.closed) node.owner = null;
        if (node.captureTeam !== null && state.players[node.captureTeam]?.closed) { node.captureTeam = null; node.captureProgress = 0; }
    }
    hydrateScenarioEntities(state);
    if (settings.learning) {
        // Practice has no rivals anywhere on the map, including stationary keeps.
        state.entities = state.entities.filter(e => e.team === 0 && (e.type === 'keep' || e.kind === 'commander'));
        state.players.forEach(p => { p.ai = false; p.stats.unitsCreated = 0; p.stats.buildingsCreated = state.entities.filter(e => e.team === p.team && e.kind === 'building').length; });
        state.map.nodes.forEach(n => n.owner = null);
        state.navigationVersion++;
        state.objectiveText = 'Learn to command: capture supplies, grow your settlement, and claim a relic.';
    }
    if (settings.mode === 'rush')
        initializeRush(state);
    updatePopulation(state);
    updateFog(state);
    return state;
}
/** Hydrate validated placements once, after player and fog rows exist.
 * Editor previews may render incomplete drafts without ticking them. */
export function hydrateScenarioEntities(state: GameState, options: { preview?: boolean } = {}) {
    const scenario = state.map.scenario;
    if (!scenario) return;
    for (const placed of scenario.startingEntities) {
        const entity = spawnEntity(state, placed.team, placed.kind, placed.type, placed.x, placed.y);
        const generatedId = entity.id;
        entity.id = placed.id; entity.x = placed.x; entity.y = placed.y;
        if (placed.kind !== 'building') entity.guardAnchor = { x: placed.x, y: placed.y };
        if (placed.kind === 'commander') {
            state.players[placed.team].commander = placed.type;
            if (placed.team === 0) state.settings.commander = placed.type;
        }
        for (const event of state.events) if (event.entityId === generatedId) event.entityId = entity.id;
        if (placed.kind === 'building')
            for (let level = 1; level < (placed.buildingLevel ?? 1); level++) applyBuildingUpgrade(state, entity);
    }
    if (!scenario.camps.length) return;
    const team = state.players.length;
    state.players.push({ team, neutral: true, name: 'Neutral defenders', faction: 'ironhold', commander: 'warlord', color: '#a7a7a7', symbol: '◆', gold: 0, wood: 0, population: 0, populationCap: 0, maxPopulation: 200, research: {}, score: 0, defeated: false, ai: false, personality: 'defensive', stats: stats(), aiNextThink: 0, aiPhase: 'Guarding the camp', lastKnownEnemies: [] });
    state.fog.visible.push(Array(state.map.width * state.map.height).fill(0));
    state.fog.explored.push(Array(state.map.width * state.map.height).fill(0));
    state.camps = [];
    for (const camp of scenario.camps) {
        const record = { id: camp.id, entityIds: [] as string[], rewardGold: camp.rewardGold, rewardWood: camp.rewardWood, cleared: false, defeatedBy: null };
        state.camps.push(record);
        const radius = camp.unit === 'cavalry' ? .42 : camp.unit === 'siege' ? .48 : .27;
        const positions: Point[] = [];
        for (let y = Math.floor(camp.y - camp.radius); y <= Math.ceil(camp.y + camp.radius); y++)
            for (let x = Math.floor(camp.x - camp.radius); x <= Math.ceil(camp.x + camp.radius); x++) {
                const point = { x: x + .5, y: y + .5 };
                if (distance(point, camp) <= camp.radius && isWalkable(state.map, point.x, point.y) && !blockers(state).has(tileIndex(state.map, point.x, point.y)) && !state.entities.some(entity => entity.kind === 'building' && living(entity) && distance(entity, point) < entity.radius + radius)) positions.push(point);
            }
        if (positions.length < camp.count && !options.preview) throw new Error(`Neutral camp ${camp.id} has insufficient clear defender positions.`);
        for (let i = 0; i < camp.count; i++) {
            const angle = i * Math.PI * 2 / camp.count, spread = Math.min(camp.radius * .35, 1.5);
            const desired = { x: camp.x + Math.cos(angle) * spread, y: camp.y + Math.sin(angle) * spread };
            positions.sort((a, b) => distance(a, desired) - distance(b, desired));
            const point = positions.shift() ?? { x: clamp(desired.x, 0, state.map.width - .01), y: clamp(desired.y, 0, state.map.height - .01) };
            const entity = spawnEntity(state, team, 'unit', camp.unit, point.x, point.y);
            if (options.preview) { entity.x = point.x; entity.y = point.y; }
            entity.campId = camp.id; entity.campRadius = camp.radius; entity.guardAnchor = { x: camp.x, y: camp.y };
            record.entityIds.push(entity.id);
        }
    }
}
function applyBuildingUpgrade(state: GameState, building: Entity) {
    const upgrade = nextBuildingUpgrade(building);
    if (!upgrade || building.kind !== 'building' || building.type === 'turret') return false;
    const definition = BUILDINGS[building.type as BuildingId];
    const hpAdded = definition.hp * FACTIONS[state.players[building.team].faction].buildingHealth * upgrade.health
        * (building.team === 0 ? state.settings.modifiers?.playerHealth ?? 1 : 1) * (state.settings.modifiers?.players?.[building.team]?.health ?? 1);
    building.buildingLevel = buildingLevel(building) + 1;
    building.maxHp += hpAdded; building.hp = Math.min(building.maxHp, building.hp + hpAdded);
    building.damage += (definition.damage ?? 0) * upgrade.damage; building.range += upgrade.range;
    return true;
}
function defeatPlayer(state: GameState, team: number) {
    const player = state.players[team];
    if (!isCompetitivePlayer(player) || player.defeated) return;
    player.defeated = true;
    for (const entity of state.entities) if (entity.team === team) { entity.queue = []; entity.targetId = null; }
    state.pendingCommands = state.pendingCommands.filter(command => command.team !== team);
    for (const node of state.map.nodes) {
        if (node.owner === team) node.owner = null;
        if (node.captureTeam === team) { node.captureTeam = null; node.captureProgress = 0; }
    }
}
function rewardClearedCamp(state: GameState, defeated: Entity, source: Entity) {
    const camp = state.camps?.find(camp => camp.id === defeated.campId);
    if (!camp || camp.cleared || !isCompetitivePlayer(state.players[source.team]) || state.entities.some(entity => entity.campId === camp.id && living(entity))) return;
    camp.cleared = true; camp.defeatedBy = source.team;
    state.players[source.team].gold += camp.rewardGold; state.players[source.team].wood += camp.rewardWood;
    emit(state, { type: 'alert', x: defeated.x, y: defeated.y, team: source.team, subtype: 'campCleared', text: `Neutral camp cleared: +${camp.rewardGold} gold, +${camp.rewardWood} wood.` });
}
export function getCommander(state: GameState, team = 0): Entity | undefined { return state.entities.find(e => e.team === team && e.kind === 'commander'); }
export function getPlayerStats(state: GameState, team = 0) { const p = state.players[team]; return { ...p.stats, gold: p.gold, wood: p.wood, population: p.population, populationCap: p.populationCap, score: p.score, research: { ...p.research }, time: state.time }; }
export function getUnitCost(state: GameState, team: number, id: UnitId) { const f = FACTIONS[state.players[team].faction]; return { gold: Math.ceil(UNITS[id].cost.gold * f.cost), wood: Math.ceil(UNITS[id].cost.wood * f.cost) }; }
function freePosition(s: GameState, x: number, y: number, radius = .3): Point {
    const free = (xx: number, yy: number) => isWalkable(s.map, xx, yy) && !blockers(s).has(tileIndex(s.map, xx, yy)) && !s.entities.some(e => e.kind === 'building' && living(e) && distance(e, { x: xx, y: yy }) < e.radius + radius);
    if (free(x, y))
        return { x, y };
    for (let r = .7; r < 7; r += .7)
        for (let n = 0; n < 16; n++) {
            const a = n * Math.PI / 8, xx = x + Math.cos(a) * r, yy = y + Math.sin(a) * r;
            if (free(xx, yy))
                return { x: xx, y: yy };
        }
    return { x: clamp(x, 1, s.map.width - 2), y: clamp(y, 1, s.map.height - 2) };
}
export function spawnEntity(s: GameState, team: number, kind: Entity['kind'], type: Entity['type'], x: number, y: number, complete = true): Entity {
    const p = s.players[team], f = FACTIONS[p.faction];
    let hp = 100, damage = 0, armor = 0, range = 0, speed = 0, vision = 6, period = 1, radius = .3, buildTime = 0;
    if (kind === 'unit') {
        const d = UNITS[type as UnitId];
        hp = d.hp * f.health;
        damage = d.damage * f.damage;
        armor = d.armor;
        range = d.range;
        speed = d.speed * f.speed;
        vision = d.vision;
        period = d.cooldown;
        radius = type === 'cavalry' ? .42 : type === 'siege' ? .48 : .27;
    }
    if (kind === 'commander') {
        const d = COMMANDERS[type as CommanderId];
        hp = d.hp * f.health;
        damage = d.damage * f.damage;
        armor = d.armor;
        range = d.range;
        speed = d.speed * f.speed;
        vision = d.vision;
        period = d.cooldown;
        radius = .42;
    }
    if (kind === 'building' && type !== 'turret') {
        const d = BUILDINGS[type as BuildingId];
        hp = d.hp * f.buildingHealth;
        damage = d.damage ?? 0;
        range = d.range ?? 0;
        vision = d.vision;
        period = 1.4;
        radius = d.size;
        buildTime = d.buildTime;
        armor = type === 'keep' ? 8 : 3;
    }
    if (type === 'turret') {
        hp = 280;
        damage = 22;
        range = 6.3;
        vision = 7;
        period = .8;
        radius = .45;
    }
    if (team === 0) {
        hp *= s.settings.modifiers?.playerHealth ?? 1;
        damage *= s.settings.modifiers?.playerDamage ?? 1;
    }
    hp *= s.settings.modifiers?.players?.[team]?.health ?? 1;
    damage *= s.settings.modifiers?.players?.[team]?.damage ?? 1;
    while (s.entities.some(entity => entity.id === `e${s.nextId}`) || s.map.scenario?.startingEntities.some(entity => entity.id === `e${s.nextId}`)) s.nextId++;
    const pos = kind === 'building' ? { x, y } : freePosition(s, x, y, radius);
    const e: Entity = { id: `e${s.nextId++}`, team, kind, type, ...pos, hp: complete ? hp : hp * .12, maxHp: hp, damage, armor, range, speed, vision, attackCooldown: 0, attackPeriod: period, radius, facing: 0, order: { type: 'idle' }, path: [], pathTarget: null, pathTimer: 0, targetId: null, buildProgress: complete ? 1 : 0, buildTime, queue: [], rally: null, abilityCooldowns: {}, buffUntil: 0, slowUntil: 0, invulnerableUntil: 0, respawnAt: null, lifetime: type === 'turret' ? 30 : null, lastHitAt: -100 };
    if (kind !== 'building')
        e.guardAnchor = { ...pos };
    s.entities.push(e);
    if (kind === 'unit')
        p.stats.unitsCreated++;
    if (kind === 'building') {
        p.stats.buildingsCreated++;
        s.navigationVersion++;
    }
    emit(s, { type: kind === 'building' ? 'build' : 'spawn', x: e.x, y: e.y, team, entityId: e.id, subtype: type });
    return e;
}
function selected(s: GameState, c: {
    team: number;
    entityIds?: string[];
}): Entity[] { return s.entities.filter(e => e.team === c.team && living(e) && e.kind !== 'building' && (c.entityIds ? c.entityIds.includes(e.id) : e.kind === 'commander')); }
function setOrder(e: Entity, order: Entity['order']) {
    e.order = order; e.path = []; e.pathTarget = null; e.pathTimer = 0; e.targetId = null; delete e.escortId; delete e.directControl;
    if (order.type === 'idle' && e.kind !== 'building')
        e.guardAnchor = { x: e.x, y: e.y };
    else
        delete e.guardAnchor;
}
function affordable(p: Player, cost: {
    gold: number;
    wood: number;
}) { return p.gold + 1e-6 >= cost.gold && p.wood + 1e-6 >= cost.wood; }
function pay(p: Player, cost: {
    gold: number;
    wood: number;
}) { p.gold -= cost.gold; p.wood -= cost.wood; }
export function canBuild(s: GameState, team: number, id: BuildingId, x: number, y: number): CommandResult {
    const d = BUILDINGS[id], p = s.players[team];
    if (!d || !p)
        return { ok: false, error: 'Unknown building.' };
    if (id === 'keep')
        return { ok: false, error: 'Your Command Keep cannot be replaced.' };
    if (!Number.isFinite(x) || !Number.isFinite(y))
        return { ok: false, error: 'Choose a valid location.' };
    if (!affordable(p, d.cost))
        return { ok: false, error: `Need ${d.cost.gold} gold and ${d.cost.wood} wood.` };
    for (let yy = y - d.size; yy <= y + d.size; yy += .6)
        for (let xx = x - d.size; xx <= x + d.size; xx += .6)
            if (!isBuildable(s.map, xx, yy))
                return { ok: false, error: 'Build on clear, dry ground.' };
    if (s.entities.some(e => e.kind === 'building' && living(e) && footprintsOverlap(e, e.radius, { x, y }, d.size)))
        return { ok: false, error: 'Too close to another building.' };
    if (s.entities.some(e => e.kind !== 'building' && living(e) && distance(e, { x, y }) < d.size + e.radius + .3))
        return { ok: false, error: 'Move your troops clear of the construction site.' };
    if (s.map.nodes.some(n => distance(n, { x, y }) < d.size + 1.4))
        return { ok: false, error: 'Leave room around the resource point.' };
    if (!s.entities.some(e => e.team === team && active(e) && (e.kind === 'building' || e.kind === 'commander') && distance(e, { x, y }) < 9) && !s.map.nodes.some(n => n.owner === team && distance(n, { x, y }) < 5))
        return { ok: false, error: 'Build near your commander, base, or captured territory.' };
    for (const pre of d.prerequisites)
        if (!s.entities.some(e => e.team === team && e.type === pre && active(e)))
            return { ok: false, error: `Requires ${BUILDINGS[pre].name}.` };
    if (!preservesAccess(s, team, x, y, d.size))
        return { ok: false, error: 'Leave an open route out of the base.' };
    return { ok: true };
}
export function issueCommand(s: GameState, c: GameCommand): CommandResult {
    if (s.winner !== null)
        return { ok: false, error: 'The battle has ended.' };
    const p = s.players[c.team];
    if (!isCompetitivePlayer(p) || p.defeated && c.type !== 'pause')
        return { ok: false, error: 'Player is not active.' };
    if (c.type === 'pause') {
        if (s.settings.difficulty === 'brutal' && c.paused)
            return { ok: false, error: 'Tactical pause is disabled on Brutal.' };
        if (s.settings.difficulty === 'hard' && c.paused && !s.paused && p.stats.pauses >= 3)
            return { ok: false, error: 'All three tactical pauses have been used.' };
        if (c.paused && !s.paused)
            p.stats.pauses++;
        s.paused = c.paused;
        if (!s.paused) {
            const pending = s.pendingCommands.splice(0);
            for (const order of pending) {
                const result = issueCommand(s, order);
                if (!result.ok)
                    emit(s, { type: 'alert', x: 0, y: 0, team: order.team, text: result.error });
            }
        }
        return { ok: true };
    }
    if (s.paused && c.type === 'steer') {
        if (c.dx || c.dy) return { ok: false, error: 'Resume the battle to move directly.' };
        return executeCommand(s, c);
    }
    if (s.paused) {
        const invalid = validateStoredCommand(s, c);
        if (invalid)
            return { ok: false, error: `This order ${invalid}` };
        if (s.pendingCommands.length >= 60)
            return { ok: false, error: 'Tactical queue is full.' };
        const planned = projectPendingCommands(s);
        const possible = executeCommand(planned, c);
        if (!possible.ok) return possible;
        s.pendingCommands.push(JSON.parse(JSON.stringify(c)));
        return { ok: true, queued: true };
    }
    const result = executeCommand(s, c);
    if (result.ok)
        s.commandLog.push({ tick: s.tick, command: JSON.parse(JSON.stringify(c)) });
    return result;
}
/** Pure planning snapshot: queued costs, capacity, footprints and jobs are reserved together. */
export function projectPendingCommands(state: GameState): GameState {
    if (!state.paused || !state.pendingCommands.length) return structuredClone(state);
    const planned = structuredClone(state); planned.paused = false; planned.pendingCommands = [];
    for (const command of state.pendingCommands) if (command.type !== 'pause') executeCommand(planned, command);
    return planned;
}
function executeCommand(s: GameState, c: Exclude<GameCommand, {
    type: 'pause';
}>): CommandResult {
    const p = s.players[c.team];
    if (c.type === 'steer') {
        if (!Number.isFinite(c.dx) || !Number.isFinite(c.dy)) return { ok: false, error: 'Invalid movement direction.' };
        const commander = getCommander(s, c.team);
        if (!commander || !living(commander)) return { ok: false, error: 'Your commander is recovering.' };
        const length = Math.hypot(c.dx, c.dy);
        setOrder(commander, { type: length > .001 ? 'hold' : 'idle' });
        if (length > .001) commander.directControl = { x: c.dx / Math.max(1, length), y: c.dy / Math.max(1, length), until: s.time + .5 };
        return { ok: true };
    }
    if (c.type === 'upgrade')
        return chooseRushUpgrade(s, c.team, c.upgrade);
    if (s.rush && ['build', 'recruit', 'research', 'rally', 'upgradeBuilding', 'cancelProduction'].includes(c.type))
        return { ok: false, error: 'In Rush Arena, find supplies and choose field upgrades.' };
    if (c.type === 'move' || c.type === 'attackMove') {
        if (!Number.isFinite(c.x) || !Number.isFinite(c.y))
            return { ok: false, error: 'Choose a valid destination.' };
        const units = selected(s, c);
        if (!units.length)
            return { ok: false, error: 'Select troops first.' };
        const target = freePosition(s, clamp(c.x, 1, s.map.width - 2), clamp(c.y, 1, s.map.height - 2));
        units.forEach((e, i) => { const a = i * 2.39996, r = units.length > 1 ? Math.sqrt(i) * .65 : 0; setOrder(e, { type: c.type, x: clamp(target.x + Math.cos(a) * r, 1, s.map.width - 2), y: clamp(target.y + Math.sin(a) * r, 1, s.map.height - 2) }); });
        if (c.type === 'attackMove')
            assignSiegeEscorts(units);
        return { ok: true };
    }
    if (c.type === 'attack') {
        const target = s.entities.find(e => e.id === c.targetId && living(e));
        if (!target || !areHostile(s, target.team, c.team))
            return { ok: false, error: 'Choose an enemy target.' };
        if (!isVisible(s, c.team, target.x, target.y))
            return { ok: false, error: 'Target is outside your vision.' };
        selected(s, c).forEach(e => setOrder(e, { type: 'attack', targetId: c.targetId }));
        return { ok: true };
    }
    if (c.type === 'hold') {
        selected(s, c).forEach(e => setOrder(e, { type: 'hold' }));
        return { ok: true };
    }
    if (c.type === 'capture') {
        const node = s.map.nodes.find(n => n.id === c.nodeId);
        if (!node)
            return { ok: false, error: 'No such resource point.' };
        selected(s, c).forEach(e => setOrder(e, { type: 'capture', x: node.x, y: node.y, nodeId: node.id }));
        return { ok: true };
    }
    if (c.type === 'rally') {
        const b = s.entities.find(e => e.id === c.buildingId && e.team === c.team && e.kind === 'building');
        if (!b || !Number.isFinite(c.x) || !Number.isFinite(c.y))
            return { ok: false, error: 'Select a friendly recruitment building.' };
        b.rally = { x: clamp(c.x, 1, s.map.width - 2), y: clamp(c.y, 1, s.map.height - 2) };
        return { ok: true };
    }
    if (c.type === 'build') {
        const check = canBuild(s, c.team, c.building, c.x, c.y);
        if (!check.ok)
            return check;
        pay(p, BUILDINGS[c.building].cost);
        spawnEntity(s, c.team, 'building', c.building, c.x, c.y, false);
        return { ok: true };
    }
    if (c.type === 'recruit') {
        const d = UNITS[c.unit];
        if (!d)
            return { ok: false, error: 'Unknown unit.' };
        const count = c.count ?? 1;
        if (!Number.isInteger(count) || count < 1 || count > PRODUCTION_QUEUE_LIMIT)
            return { ok: false, error: 'Recruit between one and twelve troops at a time.' };
        const b = s.entities.filter(e => e.team === c.team && e.kind === 'building' && e.type !== 'turret' && active(e) && BUILDINGS[e.type as BuildingId].recruits.includes(c.unit) && (!c.buildingId || e.id === c.buildingId)).sort((a, b) => a.queue.length - b.queue.length)[0];
        if (!b)
            return { ok: false, error: `Build a ${BUILDINGS[d.building].name} first.` };
        if (b.queue.length + count > PRODUCTION_QUEUE_LIMIT)
            return { ok: false, error: 'Recruitment queue is full.' };
        const one = getUnitCost(s, c.team, c.unit), cost = { gold: one.gold * count, wood: one.wood * count };
        if (!affordable(p, cost))
            return { ok: false, error: `Need ${cost.gold} gold and ${cost.wood} wood.` };
        updatePopulation(s);
        if (p.population + d.population * count > p.populationCap) {
            const free = Math.max(0, p.populationCap - p.population), needed = d.population * count;
            return { ok: false, error: `Population capacity: need ${needed} free; ${free} available. ${p.populationCap >= p.maxPopulation ? `Match ceiling ${p.maxPopulation} reached. Houses cannot raise it.` : `Build or upgrade a House for more capacity (match ceiling ${p.maxPopulation}).`}` };
        }
        pay(p, cost);
        const total = d.trainTime * (p.research.logistics ? .85 : 1);
        for (let i = 0; i < count; i++)
            b.queue.push({ type: 'unit', id: c.unit, total, remaining: total, queueId: `q${s.nextId++}`, paidCost: { ...one } });
        updatePopulation(s);
        return { ok: true };
    }
    if (c.type === 'research') {
        const d = TECHNOLOGIES[c.technology];
        if (!d)
            return { ok: false, error: 'Unknown technology.' };
        const level = p.research[c.technology] ?? 0;
        if (level >= d.maxLevel)
            return { ok: false, error: 'Research is already complete.' };
        if (s.entities.some(e => e.team === c.team && e.queue.some(q => q.type === 'research' && q.id === c.technology)))
            return { ok: false, error: 'Research is already in progress.' };
        const b = s.entities.find(e => e.team === c.team && e.type === d.building && active(e) && (!c.buildingId || e.id === c.buildingId));
        if (!b)
            return { ok: false, error: `Requires ${BUILDINGS[d.building].name}.` };
        if (b.queue.length >= PRODUCTION_QUEUE_LIMIT)
            return { ok: false, error: 'Production queue is full.' };
        const cost = technologyCost(s, c.team, c.technology);
        if (!affordable(p, cost))
            return { ok: false, error: `Need ${cost.gold} gold and ${cost.wood} wood.` };
        pay(p, cost);
        b.queue.push({ type: 'research', id: d.id, total: d.time, remaining: d.time, queueId: `q${s.nextId++}`, paidCost: { ...cost } });
        return { ok: true };
    }
    if (c.type === 'cancelProduction') {
        const building = s.entities.find(e => e.id === c.buildingId && e.team === c.team && e.kind === 'building' && living(e));
        const index = building?.queue.findIndex(q => q.queueId === c.queueId) ?? -1;
        if (!building || index < 0) return { ok: false, error: 'That production job has already finished.' };
        const refund = productionRefund(s, building, building.queue[index]);
        building.queue.splice(index, 1); p.gold += refund.gold; p.wood += refund.wood; updatePopulation(s);
        return { ok: true };
    }
    if (c.type === 'upgradeBuilding') {
        const building = s.entities.find(e => e.id === c.buildingId && e.team === c.team && e.kind === 'building' && e.type !== 'turret' && active(e));
        if (!building) return { ok: false, error: 'Select a completed friendly building.' };
        const upgrade = nextBuildingUpgrade(building);
        if (!upgrade) return { ok: false, error: 'This building is at its maximum level.' };
        if (building.queue.some(q => q.type === 'buildingUpgrade')) return { ok: false, error: 'This building upgrade is already queued.' };
        if (building.queue.length >= PRODUCTION_QUEUE_LIMIT) return { ok: false, error: 'Production queue is full.' };
        if (!affordable(p, upgrade.cost)) return { ok: false, error: `Need ${upgrade.cost.gold} gold and ${upgrade.cost.wood} wood.` };
        pay(p, upgrade.cost);
        building.queue.push({ type: 'buildingUpgrade', id: building.type as BuildingId, queueId: `q${s.nextId++}`, paidCost: { ...upgrade.cost }, total: upgrade.time, remaining: upgrade.time });
        return { ok: true };
    }
    if (c.type === 'ability')
        return useAbility(s, c.team, c.ability, c.x, c.y);
    return { ok: false, error: 'Unknown command.' };
}
export function isVisible(s: GameState, team: number, x: number, y: number) { return !!s.fog.visible[team]?.[tileIndex(s.map, x, y)]; }
function useAbility(s: GameState, team: number, id: string, x?: number, y?: number): CommandResult {
    const e = getCommander(s, team);
    if (!e || !living(e))
        return { ok: false, error: 'Your commander is recovering.' };
    const def = COMMANDERS[e.type as CommanderId].abilities.find(a => a.id === id);
    if (!def)
        return { ok: false, error: 'Ability is not available.' };
    if ((e.abilityCooldowns[id] ?? 0) > 0)
        return { ok: false, error: 'Ability is recharging.' };
    const target = { x: x ?? e.x + Math.cos(e.facing) * 5, y: y ?? e.y + Math.sin(e.facing) * 5 };
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y))
        return { ok: false, error: 'Invalid ability target.' };
    e.abilityCooldowns[id] = def.cooldown * (s.players[team].research.veterancy ? .8 : 1) * Math.pow(.75, s.rush?.upgrades.filter(u => u === 'focus').length ?? 0);
    if (id === 'charge' || id === 'dodge') {
        const d = distance(e, target), length = Math.min(id === 'charge' ? 7 : 5, d), dx = d ? (target.x - e.x) / d : Math.cos(e.facing), dy = d ? (target.y - e.y) / d : Math.sin(e.facing);
        const start = { x: e.x, y: e.y };
        for (let n = .3; n <= length; n += .3) {
            const px = start.x + dx * n, py = start.y + dy * n;
            if (!isWalkable(s.map, px, py) || s.entities.some(b => b.kind === 'building' && living(b) && distance(b, { x: px, y: py }) < b.radius + e.radius))
                break;
            e.x = px;
            e.y = py;
        }
        setOrder(e, { type: 'idle' });
        if (id === 'dodge')
            e.invulnerableUntil = s.time + 1.3;
        if (id === 'charge')
            for (const enemy of s.entities)
                if (areHostile(s, enemy.team, team) && living(enemy) && distance(enemy, e) < 3) {
                    dealDamage(s, e, enemy, 70);
                    enemy.slowUntil = s.time + 3;
                }
    }
    else if (id === 'rally' || id === 'repair') {
        for (const ally of s.entities)
            if (areAllied(s, ally.team, team) && living(ally) && distance(ally, e) < 7) {
                const heal = id === 'repair' ? (ally.kind === 'building' ? 260 : 110) : 75;
                ally.hp = Math.min(ally.maxHp, ally.hp + heal);
                if (id === 'rally')
                    ally.buffUntil = s.time + 8;
                emit(s, { type: 'heal', x: ally.x, y: ally.y, team, value: heal });
            }
    }
    else if (id === 'trap') {
        const d = distance(e, target);
        if (d > 8) {
            target.x = e.x + (target.x - e.x) * 8 / d;
            target.y = e.y + (target.y - e.y) * 8 / d;
        }
        for (const enemy of s.entities)
            if (areHostile(s, enemy.team, team) && living(enemy) && distance(enemy, target) < 3.6) {
                dealDamage(s, e, enemy, 75);
                enemy.slowUntil = s.time + 6;
            }
    }
    else if (id === 'turret') {
        const pos = freePosition(s, e.x + Math.cos(e.facing) * 1.8, e.y + Math.sin(e.facing) * 1.8, .5);
        spawnEntity(s, team, 'building', 'turret', pos.x, pos.y, true);
    }
    emit(s, { type: 'ability', x: id === 'trap' ? target.x : e.x, y: id === 'trap' ? target.y : e.y, team, entityId: e.id, subtype: id });
    return { ok: true };
}
export function combatDamage(s: GameState, attacker: Entity, target: Entity): number {
    const p = s.players[attacker.team], op = s.players[target.team];
    let amount = attacker.damage;
    if (attacker.kind === 'unit') {
        amount *= UNITS[attacker.type as UnitId].counter[target.kind === 'building' ? 'building' : target.type as UnitId] ?? 1;
        const tech = attacker.type === 'archer' ? 'fletching' : 'steel';
        amount *= 1 + (p.research[tech] ?? 0) * (tech === 'fletching' ? .12 : .15);
    }
    if (target.kind === 'building' && attacker.type !== 'siege')
        amount *= .65;
    if (attacker.buffUntil > s.time)
        amount *= 1.35;
    if (attacker.kind === 'unit' && target.kind === 'building')
        amount *= 1 + Math.max(0, s.escalation - 1) * .45;
    return Math.max(2, amount - (target.armor + (op.research.armor ?? 0) * 2));
}
function dealDamage(s: GameState, source: Entity, target: Entity, amount: number) {
    if (target.invulnerableUntil > s.time || target.hp <= 0 || !areHostile(s, source.team, target.team))
        return;
    const dealt = Math.min(target.hp, amount);
    target.hp = Math.max(0, target.hp - amount);
    target.lastHitAt = s.time;
    s.players[source.team].stats.damageDealt += dealt;
    emit(s, { type: 'hit', x: target.x, y: target.y, team: source.team, entityId: target.id, value: Math.round(dealt), subtype: source.type, sourceId: source.id, targetTeam: target.team });
    if (target.hp <= 0) {
        const loser = s.players[target.team];
        if (target.kind === 'building') {
            s.players[source.team].stats.buildingsDestroyed++;
            s.navigationVersion++;
        }
        else if (target.kind === 'unit') {
            loser.stats.unitsLost++;
            s.players[source.team].stats.kills++;
        }
        else {
            loser.stats.commanderDeaths++;
            target.respawnAt = s.time + 24;
            setOrder(target, { type: 'idle' });
        }
        emit(s, { type: 'death', x: target.x, y: target.y, team: target.team, entityId: target.id, subtype: target.type });
        if (s.rush && target.kind === 'commander' && target.team === 0)
            endGame(s, 1, 'Your commander fell in Rush Arena');
        if (target.campId) rewardClearedCamp(s, target, source);
        if (target.type === 'keep' && isCompetitivePlayer(loser) && !s.entities.some(e => e.team === target.team && e.type === 'keep' && living(e))) {
            defeatPlayer(s, target.team);
            emit(s, { type: 'alert', x: target.x, y: target.y, team: target.team, text: target.team === 0 ? 'Your Command Keep has fallen!' : `${loser.name}'s Command Keep has fallen!` });
        }
    }
}
const navCache = new WeakMap<GameState, {
    version: number;
    blocked: Set<number>;
}>();
function blockers(s: GameState) {
    const old = navCache.get(s);
    if (old && old.version === s.navigationVersion)
        return old.blocked;
    const blocked = new Set<number>();
    for (const b of s.entities)
        if (b.kind === 'building' && living(b)) {
            for (let y = Math.floor(b.y - b.radius); y <= Math.floor(b.y + b.radius); y++)
                for (let x = Math.floor(b.x - b.radius); x <= Math.floor(b.x + b.radius); x++)
                    if (distance(b, { x: x + .5, y: y + .5 }) < b.radius + .25)
                        blocked.add(y * s.map.width + x);
        }
    navCache.set(s, { version: s.navigationVersion, blocked });
    return blocked;
}
function moveToward(s: GameState, e: Entity, goal: Point, dt: number, guardRadius = IDLE_GUARD_RADIUS) {
    const dist = distance(e, goal);
    if (dist < .12) {
        e.path = [];
        return;
    }
    e.pathTimer -= dt;
    if (!e.pathTarget || distance(e.pathTarget, goal) > 1.5 || (!e.path.length && e.pathTimer <= 0)) {
        const blocked = blockers(s);
        let direct = true;
        const samples = Math.ceil(dist * 2.5);
        for (let i = 1; i <= samples; i++) {
            const t = i / samples, x = e.x + (goal.x - e.x) * t, y = e.y + (goal.y - e.y) * t;
            if (!isWalkable(s.map, x, y) || blocked.has(tileIndex(s.map, x, y))) {
                direct = false;
                break;
            }
        }
        e.path = direct ? [{ ...goal }] : findPath(s.map, e, goal, blocked);
        if (e.path.length && isWalkable(s.map, goal.x, goal.y) && !blocked.has(tileIndex(s.map, goal.x, goal.y)))
            e.path[e.path.length - 1] = { ...goal };
        e.pathTarget = { ...goal };
        e.pathTimer = e.path.length ? 1.2 : 3;
    }
    let next = e.path[0];
    if (!next)
        return;
    if (distance(e, next) < .23) {
        e.path.shift();
        next = e.path[0] ?? goal;
    }
    const dx = next.x - e.x, dy = next.y - e.y, d = Math.hypot(dx, dy);
    if (d < .01)
        return;
    e.facing = Math.atan2(dy, dx);
    let speed = movementSpeed(s, e);
    if (e.escortId && e.order.type === 'attackMove' && !e.targetId) {
        const escort = s.entities.find(a => a.id === e.escortId && living(a));
        if (escort) {
            const axis = direction(escort, e.order), ahead = (e.x - escort.x) * axis.x + (e.y - escort.y) * axis.y;
            if (ahead > 7)
                speed = 0;
            else if (ahead > 3.5)
                speed = Math.min(speed, escort.speed * .65);
        }
        else
            delete e.escortId;
    }
    const amount = Math.min(speed * dt, d), nx = e.x + dx / d * amount, ny = e.y + dy / d * amount;
    // Guards cannot route around an obstacle into an unbounded pursuit.
    // Returning guards may take a detour around terrain to their original anchor.
    const guarding = !s.rush && (e.order.type === 'idle' || e.order.type === 'capture') && e.guardAnchor;
    const returningToAnchor = guarding && distance(e, guarding) > guardRadius && distance(goal, guarding) < .3;
    if (guarding && !returningToAnchor && distance({ x: nx, y: ny }, guarding) > guardRadius && distance({ x: nx, y: ny }, guarding) >= distance(e, guarding)) {
        e.path = [];
        e.pathTimer = 0;
        return;
    }
    if (isWalkable(s.map, nx, ny) && !blockers(s).has(tileIndex(s.map, nx, ny))) {
        e.x = nx;
        e.y = ny;
    }
    else {
        e.path = [];
        e.pathTimer = 0;
    }
}
function movementSpeed(s: GameState, e: Entity): number {
    let speed = e.speed * BIOMES[s.map.biome].speed * (1 + (s.players[e.team].research.logistics ?? 0) * .15);
    const terrain = terrainAt(s.map, e.x, e.y);
    if (terrain === 'forest')
        speed *= e.type === 'cavalry' || e.type === 'siege' ? .6 : .82;
    if (terrain === 'marsh')
        speed *= .55;
    if (terrain === 'road')
        speed *= 1.12;
    if (e.slowUntil > s.time)
        speed *= .45;
    return speed;
}
function steerEntity(s: GameState, e: Entity, dt: number) {
    const input = e.directControl;
    if (!input) return;
    if (input.until <= s.time) { setOrder(e, { type: 'idle' }); return; }
    const dx = input.x * movementSpeed(s, e) * dt, dy = input.y * movementSpeed(s, e) * dt;
    const free = (x: number, y: number) => isWalkable(s.map, x, y) && !blockers(s).has(tileIndex(s.map, x, y)) && !s.entities.some(b => b.kind === 'building' && living(b) && distance(b, { x, y }) < b.radius + e.radius * .8);
    if (free(e.x + dx, e.y + dy)) { e.x += dx; e.y += dy; }
    else if (Math.abs(dx) >= Math.abs(dy)) { if (free(e.x + dx, e.y)) e.x += dx; if (free(e.x, e.y + dy)) e.y += dy; }
    else { if (free(e.x, e.y + dy)) e.y += dy; if (free(e.x + dx, e.y)) e.x += dx; }
    if (dx || dy) e.facing = Math.atan2(dy, dx);
}
function attackRange(s: GameState, e: Entity) { return e.range + (e.type === 'archer' ? (s.players[e.team].research.fletching ?? 0) : 0); }
function updateEntities(s: GameState, dt: number) {
    const alive = s.entities.filter(living);
    const spatial = new SpatialIndex(alive), byId = new Map(alive.map(entity => [entity.id, entity]));
    const maximumRadius = Math.max(0, ...alive.map(entity => entity.radius));
    const movementPadding = 2 * dt * Math.max(0, ...alive.map(entity => entity.speed * BIOMES[s.map.biome].speed * 1.12 * (1 + (s.players[entity.team].research.logistics ?? 0) * .15)));
    // Read the serialized, recent damage facts once per tick. Old unattributed
    // events do not imply an attacker, and shots dealing no damage do not count.
    const recentDamage = new Map<string, GameEvent[]>();
    if (!s.rush)
        for (const event of s.events)
            if (event.type === 'hit' && event.sourceId && event.targetTeam !== undefined && (event.value ?? 0) > 0 && event.time <= s.time && s.time - event.time < GUARD_DAMAGE_MEMORY) {
                const hits = recentDamage.get(event.sourceId) ?? [];
                hits.push(event);
                recentDamage.set(event.sourceId, hits);
            }
    for (const e of s.entities) {
        if (e.hp <= 0) {
            if (e.kind === 'commander' && e.respawnAt !== null && e.respawnAt <= s.time && !s.players[e.team].defeated) {
                const spawn = s.map.spawns[e.team], f = direction(spawn, { x: s.map.width / 2 + .5, y: s.map.height / 2 + .5 }), pos = freePosition(s, spawn.x + f.x * 3, spawn.y + f.y * 3);
                e.x = pos.x;
                e.y = pos.y;
                e.hp = e.maxHp;
                setOrder(e, { type: 'idle' });
                e.respawnAt = null;
                e.invulnerableUntil = s.time + 3;
                emit(s, { type: 'spawn', x: e.x, y: e.y, team: e.team, entityId: e.id, subtype: e.type });
            }
            continue;
        }
        if (s.players[e.team].defeated)
            continue;
        for (const key of Object.keys(e.abilityCooldowns))
            e.abilityCooldowns[key] = Math.max(0, e.abilityCooldowns[key] - dt);
        if (e.lifetime !== null) {
            e.lifetime -= dt;
            if (e.lifetime <= 0) {
                e.hp = 0;
                s.navigationVersion++;
                continue;
            }
        }
        if (e.buildProgress < 1) {
            const before = e.buildProgress;
            e.buildProgress = Math.min(1, e.buildProgress + dt / e.buildTime);
            e.hp = Math.min(e.maxHp, e.hp + (e.buildProgress - before) * e.maxHp * .88);
            if (e.buildProgress === 1)
                emit(s, { type: 'build', x: e.x, y: e.y, team: e.team, entityId: e.id, subtype: 'complete' });
            continue;
        }
        if (e.queue.length) {
            const q = e.queue[0];
            q.remaining -= dt * (q.type === 'buildingUpgrade' ? 1 : productionRate(e));
            if (q.remaining <= 0) {
                e.queue.shift();
                if (q.type === 'unit') {
                    const exit = direction(e, e.rally ?? { x: s.map.width / 2 + .5, y: s.map.height / 2 + .5 }), pos = freePosition(s, e.x + exit.x * (e.radius + 1), e.y + exit.y * (e.radius + 1));
                    const unit = spawnEntity(s, e.team, 'unit', q.id as UnitId, pos.x, pos.y);
                    const commander = getCommander(s, e.team);
                    const goal = e.rally ?? (commander && living(commander) ? commander : null);
                    if (goal)
                        setOrder(unit, { type: e.rally ? 'attackMove' : 'move', x: goal.x, y: goal.y });
                }
                else if (q.type === 'buildingUpgrade') {
                    const upgrade = nextBuildingUpgrade(e);
                    if (upgrade) {
                        applyBuildingUpgrade(s, e);
                        updatePopulation(s);
                        emit(s, { type: 'research', x: e.x, y: e.y, team: e.team, entityId: e.id, subtype: 'buildingUpgrade', text: `${upgrade.name} complete · level ${e.buildingLevel}` });
                    }
                }
                else {
                    const id = q.id as TechId;
                    s.players[e.team].research[id] = (s.players[e.team].research[id] ?? 0) + 1;
                    if (id === 'veterancy') {
                        const commander = getCommander(s, e.team);
                        if (commander) {
                            commander.maxHp *= 1.25;
                            commander.hp = Math.min(commander.maxHp, commander.hp + commander.maxHp * .2);
                        }
                    }
                    emit(s, { type: 'research', x: e.x, y: e.y, team: e.team, subtype: id, text: `${TECHNOLOGIES[id].name} complete` });
                }
            }
        }
        e.attackCooldown = Math.max(0, e.attackCooldown - dt);
        if (e.kind === 'commander' && s.time - e.lastHitAt > 7) {
            const nearKeep = s.entities.some(b => areAllied(s, b.team, e.team) && b.type === 'keep' && active(b) && distance(b, e) < 7);
            e.hp = Math.min(e.maxHp, e.hp + dt * (nearKeep ? 10 : 3));
        }
        // Fortifications retain siege damage; the Engineer's repair is intentionally valuable.
        if (e.type === 'support' && e.attackCooldown <= 0) {
            const ally = spatial.query(e, 5, movementPadding).filter(a => areAllied(s, a.team, e.team) && a.kind !== 'building' && a.hp < a.maxHp * .96 && distance(a, e) < 5).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
            if (ally) {
                const heal = s.players[e.team].faction === 'arcanists' ? 20 : 16;
                ally.hp = Math.min(ally.maxHp, ally.hp + heal);
                e.attackCooldown = 1.5;
                emit(s, { type: 'heal', x: ally.x, y: ally.y, team: e.team, value: heal });
            }
        }
        if (e.directControl) steerEntity(s, e, dt);
        let target: Entity | undefined;
        if (!s.rush && e.order.type === 'capture' && !e.guardAnchor && (distance(e, e.order) <= 2.2 || s.map.nodes.some(n => n.id === (e.order as { nodeId?: string }).nodeId && n.owner !== null && areAllied(s, n.owner, e.team))))
            e.guardAnchor = { x: e.order.x, y: e.order.y };
        const guard = !s.rush && e.order.type === 'capture' ? e.guardAnchor : !s.rush && e.kind !== 'building' && e.order.type === 'idle' ? (e.guardAnchor ??= { x: e.x, y: e.y }) : undefined;
        const activeAttackers = new Set<string>();
        if (guard && recentDamage.size)
            for (const enemy of spatial.query(guard, ACTIVE_ATTACKER_RADIUS, movementPadding))
                if (recentDamage.has(enemy.id) && areHostile(s, enemy.team, e.team) && enemy.kind !== 'building' && enemy.hp > 0 && !s.players[enemy.team].defeated && distance(enemy, guard) <= ACTIVE_ATTACKER_RADIUS && isVisible(s, e.team, enemy.x, enemy.y) && recentDamage.get(enemy.id)?.some(hit => hit.team === enemy.team && hit.targetTeam !== undefined && areAllied(s, hit.targetTeam, e.team) && (hit.entityId === e.id || distance(hit, guard) <= GUARD_CLUSTER_RADIUS)))
                    activeAttackers.add(enemy.id);
        let guardRadius = e.campRadius ?? IDLE_GUARD_RADIUS;
        const returningToObjective = guard && distance(e, guard) > (e.campRadius ?? (activeAttackers.size ? ACTIVE_GUARD_RADIUS : IDLE_GUARD_RADIUS)) + .2;
        const range = attackRange(s, e);
        if (e.order.type === 'attack') {
            const candidate = byId.get(e.order.targetId);
            if (candidate && candidate.hp > 0 && !s.players[candidate.team].defeated && areHostile(s, candidate.team, e.team) && isVisible(s, e.team, candidate.x, candidate.y)) target = candidate;
        }
        if (!target && !returningToObjective && (e.order.type !== 'move' || e.kind === 'commander')) {
            const sight = e.kind === 'building' || (e.kind === 'commander' && (e.order.type === 'move' || e.order.type === 'idle')) ? range : e.order.type === 'hold' ? range : e.order.type === 'capture' ? Math.min(e.vision, 5) : e.vision;
            let best = Infinity;
            for (const enemy of spatial.query(e, Math.max(sight + maximumRadius, guard ? distance(e, guard) + ACTIVE_ATTACKER_RADIUS : 0), movementPadding)) {
                if (!areHostile(s, enemy.team, e.team) || enemy.hp <= 0 || s.players[enemy.team].defeated || !isVisible(s, e.team, enemy.x, enemy.y))
                    continue;
                const responding = activeAttackers.has(enemy.id);
                const d = distance(e, enemy) - enemy.radius;
                if (!responding && d > sight)
                    continue;
                if (!responding && e.order.type === 'capture' && distance(enemy, e.order) > 6.5)
                    continue;
                if (guard && distance(enemy, guard) - enemy.radius > (e.campRadius ?? (responding ? ACTIVE_GUARD_RADIUS : IDLE_GUARD_RADIUS)) + range)
                    continue;
                const priority = d + (responding ? -20 : 0) + (e.type === 'siege' ? (enemy.kind === 'building' ? -4 : 6) : (enemy.kind === 'building' ? 3 : 0));
                if (priority < best) {
                    best = priority;
                    target = enemy;
                }
            }
        }
        if (target && e.damage > 0) {
            if (activeAttackers.has(target.id))
                guardRadius = e.campRadius ?? ACTIVE_GUARD_RADIUS;
            e.targetId = target.id;
            const d = distance(e, target);
            e.facing = Math.atan2(target.y - e.y, target.x - e.x);
            if (s.players[e.team].ai && (s.players[e.team].difficulty ?? s.settings.difficulty) !== 'easy' && !s.players[e.team].neutral && e.kind !== 'building' && e.type !== 'siege' && range > 3 && target.range < 3 && d < range * .65 && d > .1 && e.attackCooldown > .25 && e.order.type !== 'hold' && e.order.type !== 'move') {
                moveToward(s, e, { x: clamp(e.x + (e.x - target.x) / d * 2.2, 1, s.map.width - 2), y: clamp(e.y + (e.y - target.y) / d * 2.2, 1, s.map.height - 2) }, dt, guardRadius);
            }
            if (d <= range + target.radius) {
                if (e.attackCooldown <= 0) {
                    e.attackCooldown = e.attackPeriod;
                    emit(s, { type: range > 2 ? 'projectile' : 'attack', x: e.x, y: e.y, targetX: target.x, targetY: target.y, team: e.team, entityId: e.id, subtype: e.type });
                    dealDamage(s, e, target, combatDamage(s, e, target));
                }
            }
            else if (e.kind !== 'building' && e.order.type !== 'hold' && e.order.type !== 'move') {
                const delta = guard ? direction(guard, target) : undefined;
                const goal = guard && delta ? { x: guard.x + delta.x * Math.min(guardRadius, distance(guard, target)), y: guard.y + delta.y * Math.min(guardRadius, distance(guard, target)) } : target;
                moveToward(s, e, goal, dt, guardRadius);
            }
            if (e.kind === 'commander' && e.order.type === 'move')
                moveToward(s, e, e.order, dt);
        }
        else {
            e.targetId = null;
            if (guard && distance(e, guard) > .3)
                moveToward(s, e, guard, dt);
            else if (e.kind !== 'building' && (e.order.type === 'move' || e.order.type === 'attackMove' || e.order.type === 'capture')) {
                const goal = e.order;
                if (distance(e, goal) > .3)
                    moveToward(s, e, goal, dt);
                else if (e.order.type !== 'capture')
                    setOrder(e, { type: 'idle' });
            }
        }
    }
    // Gentle deterministic local separation preserves readable squads without physics dependency.
    if (s.tick % 2 === 0)
        for (let i = 0; i < alive.length; i++) {
            const a = alive[i];
            if (a.kind === 'building' || a.hp <= 0)
                continue;
            for (let j = i + 1; j < alive.length; j++) {
                const b = alive[j];
                if (b.kind === 'building' || b.hp <= 0)
                    continue;
                let dx = b.x - a.x, dy = b.y - a.y;
                const min = (a.radius + b.radius) * .8;
                // A pair outside either axis cannot overlap. Keep the exact
                // distance and original pair order for all close neighbors.
                if (Math.abs(dx) >= min || Math.abs(dy) >= min) continue;
                let d = Math.hypot(dx, dy);
                if (d < .001) {
                    dx = Math.cos((i + j) * 2.39996) * .001;
                    dy = Math.sin((i + j) * 2.39996) * .001;
                    d = .001;
                }
                if (d < min) {
                    const push = (min - d) * .2, px = dx / d * push, py = dy / d * push;
                    if (isWalkable(s.map, a.x - px, a.y - py) && !blockers(s).has(tileIndex(s.map, a.x - px, a.y - py))) {
                        a.x -= px;
                        a.y -= py;
                    }
                    if (isWalkable(s.map, b.x + px, b.y + py) && !blockers(s).has(tileIndex(s.map, b.x + px, b.y + py))) {
                        b.x += px;
                        b.y += py;
                    }
                }
            }
        }
    // Preserve commanders for respawning; other fallen objects are transient events only.
    s.entities = s.entities.filter(e => e.hp > 0 || e.kind === 'commander');
}
function updatePopulation(s: GameState) {
    for (const p of s.players) {
        let cap = 0, pop = 0;
        for (const e of s.entities)
            if (e.team === p.team && living(e)) {
                if (e.kind === 'unit')
                    pop += UNITS[e.type as UnitId].population;
                if (e.kind === 'building' && e.type !== 'turret' && active(e))
                    cap += buildingPopulation(e);
                for (const q of e.queue)
                    if (q.type === 'unit')
                        pop += UNITS[q.id as UnitId].population;
            }
        p.population = pop;
        p.populationCap = Math.min(p.maxPopulation, cap);
    }
}
function updateEconomy(s: GameState, dt: number) {
    for (const p of s.players)
        if (isCompetitivePlayer(p) && !p.defeated) {
            const { goldPerSecond: gold, woodPerSecond: wood, withdrawals } = getEconomyRates(s, p.team, dt);
            for (const { nodeIndex, amount } of withdrawals) {
                const node = s.map.nodes[nodeIndex];
                node.amount -= amount;
                if (node.amount <= 0)
                    emit(s, { type: 'alert', x: node.x, y: node.y, team: p.team, text: `${node.kind === 'gold' ? 'Gold mine' : 'Timber grove'} depleted. Expand to a fresh deposit.` });
            }
            p.gold += gold * dt;
            p.wood += wood * dt;
            p.stats.goldCollected += gold * dt;
            p.stats.woodCollected += wood * dt;
        }
}
function updateCapture(s: GameState, dt: number) {
    for (const node of s.map.nodes) {
        const pressure = new Map<number, number>();
        for (const e of s.entities)
            if (living(e) && e.kind !== 'building' && !s.players[e.team].defeated && !s.players[e.team].closed && distance(e, node) < node.radius)
                pressure.set(e.team, (pressure.get(e.team) ?? 0) + (e.kind === 'commander' ? 2 : 1));
        const teams = [...pressure.keys()];
        if (!teams.length) { node.captureProgress = Math.max(0, node.captureProgress - dt * .03); continue; }
        const first = teams[0];
        if (teams.some(team => !areAllied(s, first, team)) || !isCompetitivePlayer(s.players[first])) continue;
        if (node.owner !== null && areAllied(s, node.owner, first)) {
            node.captureProgress = Math.max(0, node.captureProgress - dt * .15);
            if (node.captureProgress === 0) node.captureTeam = null;
            continue;
        }
        const team = node.captureTeam !== null && pressure.has(node.captureTeam) && areAllied(s, node.captureTeam, first) ? node.captureTeam : first;
        const count = [...pressure.values()].reduce((total, value) => total + value, 0);
        if (node.captureTeam !== team) { node.captureTeam = team; node.captureProgress = 0; }
        node.captureProgress += dt * Math.min(3, count) / 18 * (s.settings.modifiers?.captureSpeed ?? 1) * (s.settings.modifiers?.players?.[team]?.captureSpeed ?? 1);
        if (node.captureProgress >= 1) {
            node.owner = team; node.captureProgress = 0; node.captureTeam = null;
            s.players[team].stats.captures++;
            emit(s, { type: 'capture', x: node.x, y: node.y, team, subtype: node.kind, text: node.kind === 'relic' ? 'Relic secured' : 'Resource point secured' });
        }
    }
    if (s.settings.mode !== 'conquest')
        for (const p of s.players)
            if (isCompetitivePlayer(p) && !p.defeated) {
                const count = s.map.nodes.filter(n => n.kind === 'relic' && n.owner !== null && areAllied(s, n.owner, p.team)).length;
                const ownCount = s.map.nodes.filter(n => n.kind === 'relic' && n.owner === p.team).length;
                const controlRate = count === 0 ? 0 : count === 1 ? .5 : count === 2 ? 1 : 1.4 + (count - 3) * .3;
                // Partition the alliance total rather than multiplying score per ally.
                p.score += controlRate * (ownCount / Math.max(1, count)) * dt * s.escalation * (s.settings.mode === 'relic' ? 1.15 : 1);
            }
}
export function updateFog(s: GameState) {
    const { width, height } = s.map;
    for (const p of s.players) {
        const visible = s.fog.visible[p.team];
        visible.fill(0);
        for (const e of s.entities)
            if (areAllied(s, e.team, p.team) && !s.players[e.team].defeated && active(e)) {
                const r = e.vision * BIOMES[s.map.biome].vision, minX = Math.max(0, Math.floor(e.x - r)), maxX = Math.min(width - 1, Math.ceil(e.x + r)), minY = Math.max(0, Math.floor(e.y - r)), maxY = Math.min(height - 1, Math.ceil(e.y + r));
                for (let y = minY; y <= maxY; y++)
                    for (let x = minX; x <= maxX; x++)
                        if ((x + .5 - e.x) ** 2 + (y + .5 - e.y) ** 2 <= r * r) {
                            const i = y * width + x;
                            visible[i] = 1;
                            s.fog.explored[p.team][i] = 1;
                        }
            }
        for (const n of s.map.nodes)
            if (n.owner !== null && areAllied(s, n.owner, p.team))
                for (let y = Math.max(0, Math.floor(n.y - 3)); y < Math.min(height, n.y + 3); y++)
                    for (let x = Math.max(0, Math.floor(n.x - 3)); x < Math.min(width, n.x + 3); x++) {
                        const i = y * width + x;
                        visible[i] = 1;
                        s.fog.explored[p.team][i] = 1;
                    }
    }
    // Allies share their exploration history, including newly formed alliances.
    for (const p of s.players) {
        const allies = allianceMembers(s, p.team).filter(ally => ally.team > p.team);
        for (const ally of allies)
            for (let i = 0; i < width * height; i++)
                if (s.fog.explored[p.team][i] || s.fog.explored[ally.team][i]) s.fog.explored[p.team][i] = s.fog.explored[ally.team][i] = 1;
    }
    if (s.rush) {
        for (const row of s.fog.visible)
            row.fill(1);
        for (const row of s.fog.explored)
            row.fill(1);
    }
    s.lastFogTick = s.tick;
}
function endGame(s: GameState, team: number, reason: string) {
    if (s.winner !== null || !isCompetitivePlayer(s.players[team])) return;
    team = allianceRepresentative(s, team);
    s.winner = team; s.victoryReason = reason;
    emit(s, { type: 'victory', x: s.map.spawns[team].x, y: s.map.spawns[team].y, team, text: reason });
}
function checkVictory(s: GameState) {
    if (s.settings.learning) return;
    const remaining = s.players.filter(p => isCompetitivePlayer(p) && !p.defeated);
    if (s.settings.scriptedVictory) {
        if (s.players[0].defeated) {
            const rival = s.players.find(p => isCompetitivePlayer(p) && areHostile(s, p.team, 0)) ?? s.players.find(p => isCompetitivePlayer(p) && p.team !== 0);
            if (rival && s.winner === null) {
                s.winner = rival.team; s.victoryReason = 'Your Command Keep has fallen';
                emit(s, { type: 'victory', x: s.map.spawns[rival.team].x, y: s.map.spawns[rival.team].y, team: rival.team, text: s.victoryReason });
            }
        }
        return;
    }
    if (remaining.length && remaining.every(p => areAllied(s, p.team, remaining[0].team))) {
        endGame(s, remaining[0].team, 'All enemy Command Keeps destroyed'); return;
    }
    for (const p of remaining)
        if (allianceMembers(s, p.team).reduce((score, ally) => score + ally.score, 0) >= s.scoreTarget) {
            endGame(s, p.team, 'Relic domination'); return;
        }
    if (s.settings.mode === 'conquest' && s.time > s.settings.duration * 120) {
        for (const p of remaining) {
            const keep = s.entities.find(e => e.team === p.team && e.type === 'keep' && living(e));
            if (keep) keep.hp = Math.max(1, keep.hp - FIXED_STEP * (2 + (s.time - s.settings.duration * 120) / 60));
        }
        if (s.time > s.settings.duration * 180 && remaining.length) {
            const strength = (p: Player) => s.entities.filter(e => areAllied(s, e.team, p.team) && !s.players[e.team].defeated && living(e)).reduce((sum, e) => sum + e.hp, 0) + allianceMembers(s, p.team).reduce((sum, ally) => sum + ally.stats.damageDealt * .1, 0);
            const ranked = [...remaining].sort((a, b) => strength(b) - strength(a) || a.team - b.team);
            endGame(s, ranked[0].team, 'Frontier storm: strongest surviving army');
        }
    }
}
function updateScripts(s: GameState) {
    for (const trigger of s.triggers) {
        if (s.winner !== null) break;
        if (!trigger.fired && evaluateScriptCondition(s, trigger.when)) {
            trigger.fired = true;
            for (const action of trigger.actions) applyScriptAction(s, action);
        }
    }
}
function applyScriptAction(s: GameState, a: ScriptAction) {
    if (a.type === 'dialogue')
        emit(s, { type: 'dialogue', x: 0, y: 0, team: a.team ?? 0, text: a.text });
    if (a.type === 'resources') {
        s.players[a.team].gold += a.gold;
        s.players[a.team].wood += a.wood;
    }
    if (a.type === 'spawn')
        for (let i = 0; i < a.count; i++)
            spawnEntity(s, a.team, 'unit', a.unit, a.x + (i % 3) * .7, a.y + Math.floor(i / 3) * .7);
    if (a.type === 'victory')
        endGame(s, a.team, 'Mission objectives complete');
    if (a.type === 'reveal') {
        s.fog.explored[a.team].fill(1);
        s.fog.visible[a.team].fill(1);
    }
    if (a.type === 'objective') s.objectiveText = a.text;
    if (a.type === 'defeat') {
        defeatPlayer(s, a.team);
        emit(s, { type: 'alert', x: s.map.spawns[a.team].x, y: s.map.spawns[a.team].y, team: a.team, text: `${s.players[a.team].name} was defeated.` });
        if (s.settings.scriptedVictory && a.team === 0) checkVictory(s);
    }
    if (a.type === 'alliance') {
        s.players[a.team].alliance = a.alliance;
        for (const entity of s.entities) {
            if (entity.order.type === 'attack') {
                const target = s.entities.find(target => target.id === (entity.order as {targetId:string}).targetId);
                if (target && areAllied(s, entity.team, target.team)) setOrder(entity, { type: 'idle' });
            }
            entity.targetId = null;
        }
        updateFog(s);
    }
}
export function stepGame(s: GameState, elapsedSeconds: number): void {
    if (s.paused || s.winner !== null || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0)
        return;
    s.accumulator += elapsedSeconds;
    while (s.accumulator + 1e-9 >= FIXED_STEP && s.winner === null && !s.paused) {
        s.accumulator -= FIXED_STEP;
        if (s.accumulator < 1e-9)
            s.accumulator = 0;
        s.tick++;
        s.time = s.tick * FIXED_STEP;
        s.escalation = 1 + Math.max(0, s.time / (s.settings.duration * 60) - .5) * 1.4;
        s.events = s.events.filter(e => s.time - e.time < 2.5);
        if (s.tick - s.lastFogTick >= 5)
            updateFog(s);
        if (s.rush) {
            updateRush(s, FIXED_STEP);
            updateEntities(s, FIXED_STEP);
            updatePopulation(s);
        }
        else {
            updateEconomy(s, FIXED_STEP);
            updateEntities(s, FIXED_STEP);
            updateCapture(s, FIXED_STEP);
            updatePopulation(s);
            if (s.settings.scriptedVictory && s.players[0].defeated) checkVictory(s);
            updateScripts(s);
            for (const p of s.players)
                if (isCompetitivePlayer(p) && p.ai && !p.defeated && s.time >= p.aiNextThink)
                    thinkAI(s, p);
            checkVictory(s);
        }
    }
}
function tryAIBuild(s: GameState, p: Player, id: BuildingId, origin?: Point): boolean {
    const center = origin ?? s.map.spawns[p.team];
    const phase = p.team * .7;
    for (let ring = 3; ring <= 15; ring += 1.25)
        for (let i = 0; i < 16; i++) {
            const a = i * Math.PI / 8 + phase, x = Math.round((center.x + Math.cos(a) * ring) * 2) / 2, y = Math.round((center.y + Math.sin(a) * ring) * 2) / 2;
            if (canBuild(s, p.team, id, x, y).ok)
                return issueCommand(s, { type: 'build', team: p.team, building: id, x, y }).ok;
        }
    return false;
}
function aiOrder(s: GameState, p: Player, entities: Entity[], goal: Point, nodeId?: string) {
    for (const e of entities) {
        if (!living(e))
            continue;
        const order = e.order;
        const movement = p.aiPhase === 'Preparing the opening army' ? 'move' : 'attackMove';
        if ((order.type === 'capture' || order.type === movement) && distance(order, goal) < 2)
            continue;
        setOrder(e, nodeId ? { type: 'capture', x: goal.x, y: goal.y, nodeId } : { type: movement, x: goal.x, y: goal.y });
    }
    if (!nodeId && p.aiPhase === 'Advancing a combined siege column')
        assignSiegeEscorts(entities);
}
function assignSiegeEscorts(entities: Entity[]) {
    const siege = entities.find(e => e.type === 'siege' && living(e));
    if (siege)
        for (const unit of entities)
            if (unit.type !== 'siege')
                unit.escortId = siege.id;
}
function thinkAI(s: GameState, p: Player) {
    const difficulty = p.difficulty ?? s.settings.difficulty;
    const interval = { easy: 4.2, normal: 2.5, hard: 1.5, brutal: .8 }[difficulty];
    p.aiNextThink = s.time + interval;
    const mine = s.entities.filter(e => e.team === p.team && living(e)), buildings = mine.filter(e => e.kind === 'building'), army = mine.filter(e => e.kind === 'unit'), commander = mine.find(e => e.kind === 'commander'), spawn = s.map.spawns[p.team];
    const has = (id: BuildingId) => buildings.some(e => e.type === id), ready = (id: BuildingId) => buildings.some(e => e.type === id && active(e));
    const visibleEnemies = s.entities.filter(e => areHostile(s, e.team, p.team) && living(e) && !s.players[e.team].defeated && isVisible(s, p.team, e.x, e.y));
    p.lastKnownEnemies = visibleEnemies.slice(0, 12).map(e => ({ x: e.x, y: e.y }));
    if (p.population >= p.populationCap - 3 && p.populationCap < p.maxPopulation && !buildings.some(e => e.type === 'house' && e.buildProgress < 1))
        tryAIBuild(s, p, 'house');
    if (!has('barracks') && s.time > 35)
        tryAIBuild(s, p, 'barracks');
    if (!has('range') && s.time > 20)
        tryAIBuild(s, p, 'range');
    if (!has('stable') && s.time > 100 && p.gold > 145)
        tryAIBuild(s, p, 'stable');
    if (!has('blacksmith') && s.time > 140 && p.gold > 180)
        tryAIBuild(s, p, 'blacksmith');
    if (!has('workshop') && s.time > 210 && ready('blacksmith') && p.gold > 180)
        tryAIBuild(s, p, 'workshop');
    if (p.personality === 'defensive' && s.time > 65 && buildings.filter(e => e.type === 'tower').length < 2 && p.gold > 130)
        tryAIBuild(s, p, 'tower');
    if ((p.personality === 'economic' || p.personality === 'expansionist') && s.time > 90 && !has('depot')) {
        const n = s.map.nodes.find(n => n.owner === p.team && n.kind === 'gold');
        if (n)
            tryAIBuild(s, p, 'depot', n);
    }
    if (s.time > 80 && p.gold > 190 && p.wood > 155 && (p.research.economy ?? 0) < 1)
        issueCommand(s, { type: 'research', team: p.team, technology: 'economy' });
    if (p.personality === 'economic' && s.time > 180 && p.gold > 210 && p.wood > 210 && (p.research.economy ?? 0) === 1)
        issueCommand(s, { type: 'research', team: p.team, technology: 'economy' });
    if (s.time > 210 && p.gold > 270 && p.wood > 170) {
        const techs: TechId[] = ['steel', 'armor', 'fletching', 'logistics', 'veterancy'];
        const choice = techs.find(t => (p.research[t] ?? 0) < 1);
        if (choice)
            issueCommand(s, { type: 'research', team: p.team, technology: choice });
    }
    // Counter choices use sighted forces, never hidden enemy unit state.
    const cavalry = visibleEnemies.filter(e => e.type === 'cavalry').length, ranged = visibleEnemies.filter(e => e.type === 'archer').length, infantry = visibleEnemies.filter(e => e.type === 'swordsman' || e.type === 'spearman').length;
    const choices: UnitId[] = [];
    if (ready('workshop') && army.filter(e => e.type === 'siege').length < Math.max(1, Math.floor(army.length / 10)))
        choices.push('siege');
    if (ready('range') && army.length > 6 && army.filter(e => e.type === 'support').length < Math.floor(army.length / 9))
        choices.push('support');
    if (cavalry > ranged + 1)
        choices.push('spearman');
    else if (ranged > infantry && ready('stable'))
        choices.push('cavalry');
    else if (infantry > 3 && ready('range'))
        choices.push('archer');
    if (p.personality === 'raider' && ready('stable') && army.filter(e => e.type === 'cavalry').length < Math.max(2, army.length * .4))
        choices.unshift('cavalry');
    const cycle: UnitId[] = p.personality === 'aggressive' ? ['swordsman', 'spearman', 'swordsman', 'cavalry', 'archer', 'swordsman'] : ['swordsman', 'archer', 'spearman', 'archer', 'cavalry', 'swordsman'];
    choices.push(cycle[Math.floor(s.time / interval + p.team) % cycle.length], 'swordsman', 'spearman');
    const savingForExpansion = (!has('range') && s.time > 20) || (s.time > 160 && !has('blacksmith')) || (s.time > 260 && ready('blacksmith') && !has('workshop'));
    const economyPending = buildings.some(e => e.queue.some(q => q.type === 'research' && q.id === 'economy'));
    const savingForEconomy = s.time > 115 && (p.research.economy ?? 0) < 1 && !economyPending && !savingForExpansion;
    // Spend only surplus, through the same paid production command as the player.
    if (s.time > 240 && army.length >= 6 && !savingForExpansion && !savingForEconomy) {
        const priorities: BuildingId[] = p.personality === 'economic' ? ['depot', 'house', 'barracks', 'range', 'keep'] : p.personality === 'defensive' ? ['tower', 'keep', 'house', 'barracks', 'range'] : ['house', 'barracks', 'range', 'workshop', 'stable', 'keep'];
        for (const id of priorities) {
            const building = buildings.find(building => building.type === id && active(building) && !building.queue.length && nextBuildingUpgrade(building));
            const upgrade = building && nextBuildingUpgrade(building);
            if (!building || !upgrade || id === 'house' && (p.populationCap >= p.maxPopulation || p.population < p.populationCap - 6) || id === 'depot' && !s.map.nodes.some(node => node.owner === p.team && node.kind !== 'relic' && node.amount > 100 && distance(node, building) < 7)) continue;
            if (p.gold >= upgrade.cost.gold + 220 && p.wood >= upgrade.cost.wood + 140) {
                if (issueCommand(s, { type: 'upgradeBuilding', team: p.team, buildingId: building.id }).ok) break;
            }
        }
    }
    if (savingForEconomy)
        issueCommand(s, { type: 'research', team: p.team, technology: 'economy' });
    const canProduce = (id: UnitId) => buildings.some(e => active(e) && e.type !== 'turret' && BUILDINGS[e.type as BuildingId].recruits.includes(id));
    const queuedType = (id: UnitId) => buildings.some(e => e.queue.some(q => q.type === 'unit' && q.id === id));
    const desired = choices.find(id => canProduce(id) && !queuedType(id)) ?? 'swordsman';
    if (!p.aiRecruitPlan || !canProduce(p.aiRecruitPlan))
        p.aiRecruitPlan = desired;
    if (!savingForExpansion && !savingForEconomy && issueCommand(s, { type: 'recruit', team: p.team, unit: p.aiRecruitPlan }).ok)
        p.aiRecruitPlan = undefined;
    const threats = visibleEnemies.filter(e => e.kind !== 'building' && distance(e, spawn) < 11);
    const easyOpening = difficulty === 'easy' && s.time < EASY_OPENING_SECONDS;
    let goal: Point | undefined, nodeId: string | undefined;
    if (threats.length >= (easyOpening ? 1 : 2)) {
        goal = threats[0];
        p.aiPhase = 'Defending the command keep';
    }
    else if (easyOpening) {
        // Spend the first minute consolidating the home side, rather than racing
        // through neutral camps into a beginner's starter army. Costs and combat
        // remain unchanged, and a genuine home attack still triggers defense.
        const homeSide = (point: Point) => s.map.spawns.every((other, team) => !isCompetitivePlayer(s.players[team]) || areAllied(s, team, p.team) || distance(point, spawn) + 4 < distance(point, other));
        const local = s.map.nodes.filter(n => n.kind !== 'relic' && n.amount > 100 && (n.owner === null || !areAllied(s, n.owner, p.team)) && homeSide(n)).sort((a, b) => distance(a, commander ?? spawn) - distance(b, commander ?? spawn))[0];
        if (local) {
            goal = local;
            nodeId = local.id;
            p.aiPhase = 'Securing nearby supplies';
        }
        else {
            const inward = direction(spawn, { x: s.map.width / 2 + .5, y: s.map.height / 2 + .5 });
            goal = freePosition(s, spawn.x + inward.x * 5, spawn.y + inward.y * 5);
            p.aiPhase = 'Preparing the opening army';
        }
    }
    else {
        const ownedGold = s.map.nodes.filter(n => n.kind === 'gold' && n.owner === p.team && n.amount > 100).length, ownedWood = s.map.nodes.filter(n => n.kind === 'wood' && n.owner === p.team && n.amount > 100).length;
        const scarce = ownedGold === 0 ? 'gold' : ownedWood === 0 ? 'wood' : p.gold < 110 && p.wood > 180 ? 'gold' : p.wood < 100 && p.gold > 180 ? 'wood' : null;
        const deposits = s.map.nodes.filter(n => n.kind !== 'relic' && (n.owner === null || !areAllied(s, n.owner, p.team)) && n.amount > 100 && (n.owner === null || s.fog.explored[p.team][tileIndex(s.map, n.x, n.y)] === 1)).sort((a, b) => { const score = (n: typeof a) => distance(n, commander ?? spawn) + (scarce && n.kind !== scarce ? 24 : 0) + (n.owner !== null && distance(n, s.map.spawns[n.owner]) < 9 ? 10 : 0); return score(a) - score(b); });
        const relics = s.map.nodes.filter(n => n.kind === 'relic' && (n.owner === null || !areAllied(s, n.owner, p.team))).sort((a, b) => distance(a, commander ?? spawn) - distance(b, commander ?? spawn));
        const owned = s.map.nodes.filter(n => n.kind !== 'relic' && n.owner === p.team && n.amount > 100).length;
        if (deposits.length && (s.time < 90 || ownedGold === 0 || ownedWood === 0 || (scarce === 'gold' && ownedGold < 2) || (scarce === 'wood' && ownedWood < 2) || ((p.personality === 'economic' || p.personality === 'expansionist') && s.time < 160))) {
            goal = deposits[0];
            nodeId = deposits[0].id;
            p.aiPhase = 'Expanding the economy';
        }
        else if (relics.length && (s.settings.mode !== 'conquest' || (army.length < 8 && s.time < 180))) {
            goal = relics[0];
            nodeId = relics[0].id;
            p.aiPhase = 'Contesting the relics';
        }
        else if (s.settings.mode !== 'conquest' && s.time < s.settings.duration * (p.personality === 'aggressive' ? 25 : 45)) {
            const defend = s.map.nodes.filter(n => n.kind === 'relic' && n.owner === p.team).sort((a, b) => distance(a, spawn) - distance(b, spawn))[0];
            if (defend) {
                goal = defend;
                nodeId = defend.id;
                p.aiPhase = 'Holding the relic line';
            }
        }
        else {
            const enemy = s.players.filter(q => isCompetitivePlayer(q) && areHostile(s, q.team, p.team) && !q.defeated).sort((a, b) => b.score - a.score)[0];
            if (enemy) {
                goal = s.map.spawns[enemy.team];
                p.aiPhase = 'Assaulting the enemy keep';
            }
        }
    }
    if (s.settings.mode === 'conquest' && s.time > 120 && threats.length < 2) {
        const siege = army.filter(e => e.type === 'siege').length;
        if ((p.aiAttackUntil ?? 0) > s.time && army.length < 2)
            p.aiAttackUntil = 0;
        if ((p.aiAttackUntil ?? 0) <= s.time)
            p.aiStageSince ??= s.time;
        if ((army.length >= (p.personality === 'aggressive' ? 6 : 8) && (siege >= 1 || !ready('workshop'))) || (siege >= 2 && army.length >= 5) || ((s.time - (p.aiStageSince ?? s.time) > 65) && army.length >= 3) || (s.time > s.settings.duration * 60 && siege >= 1 && army.length >= 2)) {
            p.aiAttackUntil = s.time + 100;
            p.aiStageSince = undefined;
        }
        const enemy = s.players.filter(q => isCompetitivePlayer(q) && areHostile(s, q.team, p.team) && !q.defeated).sort((a, b) => distance(s.map.spawns[a.team], spawn) - distance(s.map.spawns[b.team], spawn))[0];
        if ((p.aiAttackUntil ?? 0) > s.time && enemy) {
            goal = s.map.spawns[enemy.team];
            nodeId = undefined;
            p.aiPhase = 'Advancing a combined siege column';
        }
        else if (p.aiPhase !== 'Expanding the economy') {
            const center = { x: s.map.width / 2, y: s.map.height / 2 }, d = distance(center, spawn);
            goal = freePosition(s, spawn.x + (center.x - spawn.x) / d * 6, spawn.y + (center.y - spawn.y) / d * 6);
            nodeId = undefined;
            p.aiPhase = 'Staging troops and siege escorts';
        }
    }
    if (goal) {
        const fighters = [...army, ...(commander ? [commander] : [])];
        // A small detached patrol captures a second point while the commander leads the main force.
        if (!easyOpening && s.settings.mode !== 'conquest' && army.length >= 8 && threats.length === 0) {
            const secondary = s.map.nodes.filter(n => (n.owner === null || !areAllied(s, n.owner, p.team)) && n.id !== nodeId && (p.personality === 'raider' ? n.kind !== 'relic' && n.amount > 100 : n.kind === 'relic' || n.amount > 100)).sort((a, b) => distance(a, spawn) - distance(b, spawn))[0];
            if (secondary) {
                const patrol = army.filter(e => e.type === 'cavalry' || e.type === 'spearman').slice(-2);
                aiOrder(s, p, patrol, secondary, secondary.id);
                aiOrder(s, p, fighters.filter(e => !patrol.includes(e)), goal, nodeId);
            }
            else
                aiOrder(s, p, fighters, goal, nodeId);
        }
        else
            aiOrder(s, p, fighters, goal, nodeId);
        for (const building of buildings)
            if (building.type !== 'turret')
                building.rally = p.aiPhase === 'Preparing the opening army' ? null : { x: goal.x, y: goal.y };
        if (s.settings.mode === 'conquest' && (p.aiAttackUntil ?? 0) > s.time) {
            const fortress = visibleEnemies.filter(e => e.type === 'keep').sort((a, b) => distance(a, goal!) - distance(b, goal!))[0];
            if (fortress)
                for (const gun of army.filter(e => e.type === 'siege'))
                    if (gun.order.type !== 'attack' || gun.order.targetId !== fortress.id)
                        setOrder(gun, { type: 'attack', targetId: fortress.id });
        }
    }
    if (commander) {
        const enemies = visibleEnemies.filter(e => distance(e, commander) < 8), hurt = mine.filter(e => e.hp < e.maxHp * .7 && distance(e, commander) < 7);
        if (difficulty !== 'easy')
            for (const ability of COMMANDERS[commander.type as CommanderId].abilities) {
                const offensive = ['charge', 'trap', 'turret'].includes(ability.id), defensive = ['repair', 'rally'].includes(ability.id);
                if ((offensive && enemies.length >= 2) || (defensive && hurt.length >= 2) || (ability.id === 'dodge' && commander.hp < commander.maxHp * .4 && enemies.length)) {
                    const target = ability.id === 'dodge' ? spawn : enemies[0];
                    issueCommand(s, { type: 'ability', team: p.team, ability: ability.id, x: target?.x, y: target?.y });
                }
            }
        if (commander.hp < commander.maxHp * .22)
            p.aiCommanderRetreat = true;
        if (commander.hp > commander.maxHp * .7)
            p.aiCommanderRetreat = false;
        if (p.aiCommanderRetreat && difficulty !== 'easy') {
            const inward = direction(spawn, { x: s.map.width / 2 + .5, y: s.map.height / 2 + .5 }), refuge = freePosition(s, spawn.x + inward.x * 3, spawn.y + inward.y * 3);
            setOrder(commander, { type: 'move', ...refuge });
            p.aiPhase = 'Recovering the commander at the keep';
        }
    }
}
export function serializeGame(state: GameState): string { return JSON.stringify(state); }
function validateSavedCamps(state: GameState, fail: (message: string) => never) {
    const definitions = state.map.scenario?.camps ?? [];
    if (!definitions.length) {
        if (state.camps !== undefined && (!Array.isArray(state.camps) || state.camps.length)) fail('unexpected neutral camp state.');
        return;
    }
    if (!Array.isArray(state.camps) || state.camps.length !== definitions.length) fail('neutral camp state is missing.');
    const ids = new Set<string>(), entityIds = new Set<string>();
    for (const camp of state.camps!) {
        const definition = definitions.find(definition => definition.id === camp?.id);
        if (!definition || ids.has(camp.id) || Object.keys(camp).some(key => !['id', 'entityIds', 'rewardGold', 'rewardWood', 'cleared', 'defeatedBy'].includes(key)) || !Array.isArray(camp.entityIds) || camp.entityIds.length !== definition.count || camp.entityIds.some(id => typeof id !== 'string' || !id.length || entityIds.has(id)) || new Set(camp.entityIds).size !== camp.entityIds.length || camp.rewardGold !== definition.rewardGold || camp.rewardWood !== definition.rewardWood || typeof camp.cleared !== 'boolean') fail('neutral camp records are invalid.');
        ids.add(camp.id); camp.entityIds.forEach(id => entityIds.add(id));
        if (camp.cleared ? !Number.isInteger(camp.defeatedBy) || !isCompetitivePlayer(state.players[camp.defeatedBy!]) : camp.defeatedBy !== null) fail('neutral camp reward attribution is invalid.');
        const defenders = state.entities.filter(entity => entity.campId === camp.id);
        if (defenders.some(entity => !camp.entityIds.includes(entity.id)) || camp.cleared && defenders.some(living) || !camp.cleared && !defenders.some(living)) fail('neutral camp defenders do not match their record.');
    }
}
export function restoreGame(input: string | object): GameState {
    let data: GameState;
    try {
        data = parseBoundedJSON(typeof input === 'string' ? input : JSON.stringify(input), MAX_SAVE_JSON_BYTES) as GameState;
    }
    catch {
        throw new Error('This save is not valid JSON.');
    }
    const fail = (message: string): never => { throw new Error(`This save is damaged: ${message}`); };
    const number = (value: unknown, min = -Infinity, max = Infinity) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
    const point = (p: unknown): p is Point => !!p && typeof p === 'object' && number((p as Point).x, 0, data.map.width) && number((p as Point).y, 0, data.map.height);
    if (!data || typeof data !== 'object' || data.version !== 1)
        throw new Error('This save was created by an unsupported Frontier Command version.');
    if (!data.map || !Array.isArray(data.entities) || !Array.isArray(data.players) || !data.players.length || !number(data.time, 0) || !number(data.tick, 0) || !Number.isInteger(data.tick))
        fail('world state is incomplete.');
    if (!data.settings || typeof data.settings !== 'object')
        fail('match settings are missing.');
    data.settings = { ...DEFAULT_SETTINGS, ...data.settings, mapGenerationVersion: data.settings.mapGenerationVersion ?? (data.map.version === 3 ? 3 : data.map.version === 5 ? 5 : 4) };
    const settings = data.settings;
    if (![3, 4, 5].includes(settings.mapGenerationVersion ?? 4) || !knownId(COMMANDERS, settings.commander) || !knownId(FACTIONS, settings.faction) || !knownId(BIOMES, settings.biome) || !knownId(MAP_DIMENSIONS, settings.mapSize) || !['easy', 'normal', 'hard', 'brutal'].includes(settings.difficulty) || !['domination', 'conquest', 'relic', 'rush'].includes(settings.mode) || !['competitive', 'balanced', 'wild', 'chaotic'].includes(settings.preset) || typeof settings.seed !== 'string' || !number(settings.duration, 1, 180) || !number(settings.populationCap, 1, 500))
        fail('match settings contain unknown content or invalid values.');
    const legacyPopulationBudget = (data.map.version === 3 || data.map.version === 4) && settings.slots === undefined;
    const settingsErrors = [...validateScaleSettings(settings, { allowLegacyPopulationBudget: legacyPopulationBudget }), ...validateGameModifiers(settings.modifiers, data.map.spawns?.length ?? 6), ...(settings.slots ? validateMapPlayerSlots(settings.slots) : [])];
    if (settingsErrors.length) fail(settingsErrors.join(' '));
    if (settings.scriptedVictory !== undefined && typeof settings.scriptedVictory !== 'boolean') fail('scripted victory must be a boolean.');
    if (!Array.isArray(data.map.tiles) || !Array.isArray(data.map.spawns) || !Array.isArray(data.map.nodes) || !knownId(BIOMES, data.map.biome))
        fail('map data is incomplete.');
    if (!number(data.map.width, 16, 160) || !number(data.map.height, 16, 160) || !data.map.spawns.every(point))
        fail('map dimensions or spawn coordinates are invalid.');
    const nodeIds = new Set<string>();
    for (const n of data.map.nodes) {
        if (!n || typeof n.id !== 'string' || nodeIds.has(n.id) || !point(n) || !['gold', 'wood', 'relic'].includes(n.kind) || !number(n.radius, .1, 20) || !number(n.income, 0, 100) || !(n.owner === null || Number.isInteger(n.owner) && number(n.owner, 0, data.players.length - 1)) || !(n.captureTeam === null || Number.isInteger(n.captureTeam) && number(n.captureTeam, 0, data.players.length - 1)) || !number(n.captureProgress, 0, 1))
            fail('resource points contain invalid values.');
        nodeIds.add(n.id);
        n.amount ??= n.kind === 'relic' ? 0 : 1500;
        n.maxAmount ??= n.amount;
        if (!number(n.amount, 0) || !number(n.maxAmount, n.amount))
            fail('resource amounts are invalid.');
    }
    const validation = validateMap(data.map);
    if (!validation.valid)
        fail(`map is invalid: ${validation.errors.join(' ')}`);
    if (data.map.scenario) {
        const scenarioErrors = [...validateMapScenario(data.map.scenario, data.map.width, data.map.height, data.map.spawns.length), ...validateScenarioGeometry(data.map)];
        if (scenarioErrors.length) fail(`scenario is invalid: ${scenarioErrors.join(' ')}`);
    }
    const spawnCount = data.map.spawns.length;
    const hasCamps = !!data.map.scenario?.camps.length;
    if (data.players.length !== spawnCount + (hasCamps ? 1 : 0)) fail('player slots and neutral owner do not match the map.');
    if (settings.slots && settings.slots.length !== spawnCount) fail('player slots must match map spawns.');
    for (const [team, p] of data.players.entries()) {
        if (!p || p.team !== team || !knownId(FACTIONS, p.faction) || !knownId(COMMANDERS, p.commander) || !number(p.gold, 0) || !number(p.wood, 0) || !number(p.score, 0) || !number(p.maxPopulation, 1, 500) || !p.stats || !p.research)
            fail('player data is invalid.');
        if ((p.alliance !== undefined && (!Number.isInteger(p.alliance) || !number(p.alliance, 0, 5))) || (p.neutral !== undefined && typeof p.neutral !== 'boolean') || (p.closed !== undefined && typeof p.closed !== 'boolean') || (p.difficulty !== undefined && !['easy', 'normal', 'hard', 'brutal'].includes(p.difficulty))) fail('player alliance, controller, or difficulty is invalid.');
        if (typeof p.defeated !== 'boolean' || typeof p.ai !== 'boolean') fail('player activity flags are invalid.');
        if (team === spawnCount ? !p.neutral || p.closed || p.ai || p.defeated || p.gold !== 0 || p.wood !== 0 || p.score !== 0 : p.neutral === true) fail('neutral defenders must use the separate noncompetitive owner.');
        if (p.closed && (!p.defeated || p.ai) || settings.slots && team < spawnCount && !!p.closed !== (settings.slots[team].controller === 'closed')) fail('closed player slots are invalid.');
        for (const [id, value] of Object.entries(p.research))
            if (!knownId(TECHNOLOGIES, id as TechId) || !Number.isInteger(value) || !number(value, 0, TECHNOLOGIES[id as TechId].maxLevel))
                fail('research values are invalid.');
        for (const value of Object.values(p.stats))
            if (!number(value, 0))
                fail('statistics contain invalid values.');
    }
    const entityIds = new Set<string>();
    for (const e of data.entities) {
        if (!e || typeof e.id !== 'string' || entityIds.has(e.id) || !point(e) || !Number.isInteger(e.team) || !data.players[e.team] || !['unit', 'commander', 'building'].includes(e.kind) || (e.kind === 'unit' && !knownId(UNITS, e.type as UnitId)) || (e.kind === 'building' && e.type !== 'turret' && !knownId(BUILDINGS, e.type as BuildingId)) || (e.kind === 'commander' && !knownId(COMMANDERS, e.type as CommanderId)))
            fail('entities have unknown types, IDs, teams, or locations.');
        if (data.players[e.team].closed) fail(`entity ${e.id} belongs to a closed slot.`);
        if (e.campId !== undefined || e.campRadius !== undefined || data.players[e.team].neutral) {
            const camp = data.map.scenario?.camps.find(camp => camp.id === e.campId);
            if (!data.players[e.team].neutral || !camp || e.kind !== 'unit' || e.type !== camp.unit || e.campRadius !== camp.radius || e.order?.type !== 'idle' || e.guardAnchor?.x !== camp.x || e.guardAnchor?.y !== camp.y || e.queue?.length || e.buildProgress !== 1 || e.lifetime !== null || e.respawnAt !== null || e.directControl !== undefined) fail(`entity ${e.id} has invalid neutral camp ownership.`);
        }
        entityIds.add(e.id);
        for (const key of ['hp', 'maxHp', 'damage', 'armor', 'range', 'speed', 'vision', 'attackCooldown', 'attackPeriod', 'radius', 'buildProgress', 'buildTime', 'buffUntil', 'slowUntil', 'invulnerableUntil'] as const)
            if (!number(e[key], 0))
                fail(`entity ${e.id} has invalid ${key}.`);
        if (!number(e.speed, 0, 160) || !number(e.range, 0, 160) || !number(e.vision, 0, 160) || !number(e.radius, 0, 20)) fail(`entity ${e.id} exceeds supported movement or sight bounds.`);
        if (e.maxHp <= 0 || e.hp > e.maxHp + .001 || e.buildProgress > 1 || !number(e.facing) || !number(e.lastHitAt) || !Array.isArray(e.queue) || !e.abilityCooldowns || Object.values(e.abilityCooldowns).some(v => !number(v, 0)))
            fail(`entity ${e.id} has invalid health, production, or timers.`);
        if (!e.order || !['idle', 'hold', 'move', 'attackMove', 'capture', 'attack'].includes(e.order.type))
            fail(`entity ${e.id} has an invalid order.`);
        if (['move', 'attackMove', 'capture'].includes(e.order.type) && !point(e.order))
            fail(`entity ${e.id} has an invalid destination.`);
        if (e.order.type === 'attack' && typeof e.order.targetId !== 'string')
            fail(`entity ${e.id} has an invalid attack target.`);
        if (e.path === undefined) {
            e.path = [];
            e.pathTarget = null;
            e.pathTimer = 0;
        }
        else if (!Array.isArray(e.path) || !e.path.every(point))
            fail(`entity ${e.id} has an invalid path.`);
        e.pathTarget ??= null;
        e.pathTimer ??= 0;
        if (e.pathTarget !== null && !point(e.pathTarget) || !number(e.pathTimer))
            fail(`entity ${e.id} has invalid navigation data.`);
        if (e.guardAnchor !== undefined && !point(e.guardAnchor))
            fail(`entity ${e.id} has an invalid guard anchor.`);
        if (e.kind !== 'building' && e.order.type === 'idle')
            e.guardAnchor ??= { x: e.x, y: e.y };
        if (e.rally !== null && !point(e.rally))
            fail(`entity ${e.id} has an invalid rally point.`);
        if (e.directControl !== undefined) {
            if (!number(e.directControl.x, -1, 1) || !number(e.directControl.y, -1, 1) || !number(e.directControl.until, 0)) fail(`entity ${e.id} has invalid direct controls.`);
            // A resumed save must never retain a held thumbstick or keyboard key.
            delete e.directControl; if (e.kind === 'commander') setOrder(e, { type: 'idle' });
        }
        if (e.buildingLevel !== undefined && (!Number.isInteger(e.buildingLevel) || e.buildingLevel < 1 || e.buildingLevel > 3 || e.kind !== 'building')) fail(`entity ${e.id} has an invalid building level.`);
        for (const [index, q] of e.queue.entries()) {
            if (!q || !['unit', 'research', 'buildingUpgrade'].includes(q.type) || (q.type === 'unit' && !knownId(UNITS, q.id as UnitId)) || (q.type === 'research' && !knownId(TECHNOLOGIES, q.id as TechId)) || (q.type === 'buildingUpgrade' && (e.kind !== 'building' || q.id !== e.type || !nextBuildingUpgrade(e))) || !number(q.total, .001) || !number(q.remaining, 0, q.total))
                fail(`entity ${e.id} has an invalid production queue.`);
            q.queueId ??= `${e.id}-legacy-${index}`;
            if (typeof q.queueId !== 'string' || q.queueId.length > 100 || (q.paidCost && (!number(q.paidCost.gold, 0) || !number(q.paidCost.wood, 0)))) fail(`entity ${e.id} has invalid production costs.`);
            q.paidCost ??= queueItemCost(data, e, q);
        }
    }
    validateSavedCamps(data, fail);
    data.pendingCommands ??= [];
    if (!Array.isArray(data.pendingCommands) || data.pendingCommands.length > 60)
        fail('tactical orders are invalid.');
    for (const command of data.pendingCommands) {
        const problem = validateStoredCommand(data, command);
        if (problem)
            fail(`queued order ${problem}`);
    }
    data.accumulator ??= 0;
    if (!number(data.accumulator, 0) || !number(data.nextId, 1) || !number(data.nextEventId, 1) || !number(data.rng, 0) || !number(data.scoreTarget, 1) || !number(data.escalation, 0))
        fail('simulation counters are invalid.');
    if (!(data.winner === null || Number.isInteger(data.winner) && number(data.winner, 0, data.map.spawns.length - 1) && isCompetitivePlayer(data.players[data.winner])))
        fail('winner is invalid.');
    if (!Array.isArray(data.events) || data.events.some(e => !e || !number(e.x) || !number(e.y) || !number(e.time, 0)))
        data.events = [];
    data.commandLog ??= [];
    if (!Array.isArray(data.commandLog))
        fail('command history is invalid.');
    data.triggers ??= [];
    const triggerErrors = validateTriggers(data.triggers, { teamCount: data.map.spawns.length, width: data.map.width, height: data.map.height });
    if (triggerErrors.length)
        fail(`mission triggers are invalid: ${triggerErrors.join(' ')}`);
    data.lastFogTick ??= data.tick - 5;
    if (!Number.isInteger(data.lastFogTick) || data.lastFogTick > data.tick)
        fail('fog refresh timer is invalid.');
    data.navigationVersion ??= 0;
    const fogMissing = !data.fog || !Array.isArray(data.fog.visible) || !Array.isArray(data.fog.explored);
    const validFog = (rows: number[][]) => rows.length === data.players.length && rows.every(row => Array.isArray(row) && row.length === data.map.width * data.map.height && row.every(v => v === 0 || v === 1));
    if (fogMissing) {
        data.fog = { visible: data.players.map(() => Array(data.map.width * data.map.height).fill(0)), explored: data.players.map(() => Array(data.map.width * data.map.height).fill(0)) };
        updateFog(data);
    }
    else if (!validFog(data.fog.visible) || !validFog(data.fog.explored))
        fail('fog data is invalid.');
    if (data.settings.mode === 'rush') {
        const r = data.rush!;
        if (!r || !point(r.center) || !number(r.radius, 1, 100) || !number(r.initialRadius, 1, 100) || !number(r.surviveUntil, 1) || !number(r.wave, 0) || !number(r.nextWaveAt, 0) || !number(r.nextUpgradeAt, 0) || !number(r.upgradeAvailable, 0) || !Array.isArray(r.upgrades) || !Array.isArray(r.offeredUpgrades) || !Array.isArray(r.supplies) || !Array.isArray(r.hazards))
            fail('Rush Arena state is invalid.');
        if ([...r.upgrades, ...r.offeredUpgrades].some(id => !knownId(RUSH_UPGRADES, id)))
            fail('Rush Arena upgrades are unknown.');
        for (const p of r.supplies)
            if (!point(p) || !['heal', 'reinforcements', 'charge'].includes(p.kind) || !number(p.expiresAt, 0))
                fail('Rush Arena supplies are invalid.');
        for (const h of r.hazards)
            if (!point(h) || !number(h.radius, .1) || !number(h.detonateAt, 0))
                fail('Rush Arena hazards are invalid.');
    }
    updatePopulation(data);
    return data;
}
function validateStoredCommand(s: GameState, c: GameCommand): string | null {
    if (!c || typeof c !== 'object' || !Number.isInteger(c.team) || !isCompetitivePlayer(s.players[c.team]))
        return 'has an invalid player.';
    const position = (o: {
        x?: number;
        y?: number;
    }) => typeof o.x === 'number' && typeof o.y === 'number' && Number.isFinite(o.x) && Number.isFinite(o.y) && o.x >= 0 && o.y >= 0 && o.x < s.map.width && o.y < s.map.height;
    if ('entityIds' in c && c.entityIds !== undefined && (!Array.isArray(c.entityIds) || c.entityIds.some(id => typeof id !== 'string')))
        return 'has an invalid unit selection.';
    if (c.type === 'move' || c.type === 'attackMove')
        return position(c) ? null : 'has an invalid destination.';
    if (c.type === 'steer') return Number.isFinite(c.dx) && Number.isFinite(c.dy) ? null : 'has an invalid movement direction.';
    if (c.type === 'hold')
        return null;
    if (c.type === 'attack')
        return typeof c.targetId === 'string' ? null : 'has no attack target.';
    if (c.type === 'capture')
        return typeof c.nodeId === 'string' ? null : 'has no capture target.';
    if (c.type === 'build')
        return BUILDINGS[c.building] && position(c) ? null : 'has an invalid building or location.';
    if (c.type === 'recruit')
        return UNITS[c.unit] && (c.count === undefined || Number.isInteger(c.count) && c.count >= 1 && c.count <= PRODUCTION_QUEUE_LIMIT) ? null : 'has an unknown troop type or count.';
    if (c.type === 'research')
        return TECHNOLOGIES[c.technology] ? null : 'has an unknown technology.';
    if (c.type === 'cancelProduction') return typeof c.buildingId === 'string' && typeof c.queueId === 'string' ? null : 'has an invalid production job.';
    if (c.type === 'upgradeBuilding') return typeof c.buildingId === 'string' ? null : 'has an invalid building upgrade.';
    if (c.type === 'rally')
        return typeof c.buildingId === 'string' && position(c) ? null : 'has an invalid rally order.';
    if (c.type === 'ability') {
        const known = COMMANDERS[s.players[c.team].commander].abilities.some(a => a.id === c.ability);
        return known && (c.x === undefined && c.y === undefined || position(c)) ? null : 'has an unknown ability or target.';
    }
    if (c.type === 'upgrade')
        return RUSH_UPGRADES[c.upgrade] ? null : 'has an unknown field upgrade.';
    if (c.type === 'pause')
        return typeof c.paused === 'boolean' ? null : 'has an invalid pause value.';
    return 'has an unknown command type.';
}
function initializeRush(s: GameState) {
    s.entities = [];
    s.events = [];
    s.commandLog = [];
    s.navigationVersion++;
    s.map.purpose = 'arena';
    s.map.nodes = [];
    s.map.validation = { valid: true, errors: [], warnings: [], reachablePercent: 1, fairness: 1 };
    // Keep readable cover pockets while guaranteeing every arena sector is navigable.
    s.map.tiles = s.map.tiles.map((t, i) => { const x = i % s.map.width, y = Math.floor(i / s.map.width); return x > 1 && y > 1 && x < s.map.width - 2 && y < s.map.height - 2 && (t === 'water' || t === 'rock') ? BIOMES[s.map.biome].primary : t; });
    const center = { x: s.map.width / 2 + .5, y: s.map.height / 2 + .5 }, initialRadius = s.map.width / 2 - 3;
    s.rush = { center, radius: initialRadius, initialRadius, surviveUntil: 240, wave: 0, nextWaveAt: 5, nextUpgradeAt: 45, upgradeAvailable: 0, offeredUpgrades: [], upgrades: [], supplies: [], hazards: [], kills: 0, nextSupplyAt: 17, nextHazardAt: 50 };
    for (const p of s.players) {
        p.ai = false;
        p.gold = 0;
        p.wood = 0;
        p.stats = stats();
        p.defeated = false;
    }
    spawnEntity(s, 0, 'commander', s.players[0].commander, center.x, center.y);
    for (const [i, type] of (['swordsman', 'spearman', 'archer', 'support'] as UnitId[]).entries())
        spawnEntity(s, 0, 'unit', type, center.x + Math.cos(i * Math.PI / 2) * 1.4, center.y + Math.sin(i * Math.PI / 2) * 1.4);
    s.objectiveText = 'Survive for 4 minutes. Stay inside the frontier ring. Collect supplies and choose upgrades.';
    s.navigationVersion++;
    emit(s, { type: 'dialogue', x: center.x, y: center.y, team: 0, text: 'Rush Arena: survive the frontier. Your squad follows you. Keep moving!' });
}
function chooseRushUpgrade(s: GameState, team: number, id: RushUpgradeId): CommandResult {
    const rush = s.rush;
    if (!rush || team !== 0)
        return { ok: false, error: 'Field upgrades are available only in Rush Arena.' };
    if (rush.upgradeAvailable <= 0 || !rush.offeredUpgrades.includes(id))
        return { ok: false, error: 'That upgrade is not currently available.' };
    rush.upgradeAvailable--;
    rush.upgrades.push(id);
    const commander = getCommander(s, 0)!;
    for (const e of s.entities)
        if (e.team === 0 && living(e)) {
            if (id === 'blade')
                e.damage *= 1.25;
            if (id === 'bulwark') {
                e.maxHp *= 1.35;
                e.hp = e.maxHp;
            }
            if (id === 'fleet') {
                e.speed *= 1.2;
                e.vision += 1;
            }
            if (id === 'focus')
                for (const ability of Object.keys(e.abilityCooldowns))
                    e.abilityCooldowns[ability] = 0;
        }
    if (id === 'reinforcements')
        for (const type of ['swordsman', 'archer', 'cavalry'] as UnitId[]) {
            const e = spawnEntity(s, 0, 'unit', type, commander.x + (random(s) - .5) * 3, commander.y + (random(s) - .5) * 3);
            e.maxHp *= 1.25;
            e.hp = e.maxHp;
        }
    if (rush.upgradeAvailable > 0)
        offerRushUpgrades(s);
    else
        rush.offeredUpgrades = [];
    emit(s, { type: 'ability', x: commander.x, y: commander.y, team: 0, subtype: 'upgrade', text: 'Field upgrade acquired' });
    return { ok: true };
}
function offerRushUpgrades(s: GameState) {
    const all: RushUpgradeId[] = ['blade', 'bulwark', 'fleet', 'reinforcements', 'renewal', 'focus'];
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(random(s) * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }
    s.rush!.offeredUpgrades = all.slice(0, 3);
}
function rushDamage(s: GameState, e: Entity, amount: number) {
    if (e.invulnerableUntil > s.time || e.hp <= 0)
        return;
    e.hp = Math.max(0, e.hp - amount);
    e.lastHitAt = s.time;
    if (e.hp <= 0) {
        emit(s, { type: 'death', x: e.x, y: e.y, team: e.team, entityId: e.id, subtype: e.type });
        if (e.team === 0 && e.kind === 'commander') {
            s.players[0].stats.commanderDeaths++;
            endGame(s, 1, 'Your commander fell in Rush Arena');
        }
        else if (e.kind === 'building')
            s.navigationVersion++;
        else if (e.team === 0)
            s.players[0].stats.unitsLost++;
    }
}
function updateRush(s: GameState, dt: number) {
    const rush = s.rush!, commander = getCommander(s, 0);
    if (!commander || commander.hp <= 0) {
        endGame(s, 1, 'Your commander fell in Rush Arena');
        return;
    }
    if (s.time >= rush.surviveUntil) {
        endGame(s, 0, `Survived the Rush Arena · ${s.players[0].stats.kills} enemies defeated`);
        return;
    }
    rush.kills = s.players[0].stats.kills;
    const progress = clamp((s.time - 35) / (rush.surviveUntil - 55), 0, 1);
    rush.radius = rush.initialRadius - (rush.initialRadius - 5.8) * progress;
    for (const e of s.entities)
        if (living(e)) {
            if (distance(e, rush.center) > rush.radius)
                rushDamage(s, e, dt * (e.team === 0 ? 25 : 14));
            if (e.team === 0 && e.kind === 'commander')
                e.hp = Math.min(e.maxHp, e.hp + dt * 3 * rush.upgrades.filter(u => u === 'renewal').length);
            if (s.tick % 5 === 0 && e.kind !== 'building') {
                if (e.team === 1) {
                    if (e.order.type !== 'attack' || e.order.targetId !== commander.id)
                        setOrder(e, { type: 'attack', targetId: commander.id });
                }
                else if (e.kind === 'unit' && (e.order.type === 'idle' || distance(e, commander) > 7)) {
                    const a = Number(e.id.slice(1)) * 2.39996;
                    setOrder(e, { type: 'attackMove', x: commander.x + Math.cos(a) * 1.8, y: commander.y + Math.sin(a) * 1.8 });
                }
            }
        }
    if (s.time >= rush.nextWaveAt) {
        rush.wave++;
        rush.nextWaveAt = s.time + Math.max(12, 20 - rush.wave * .4);
        const difficultyScale = { easy: .8, normal: 1, hard: 1.2, brutal: 1.4 }[s.settings.difficulty];
        const count = Math.max(3, Math.round((3 + Math.floor(rush.wave * .5)) * difficultyScale));
        const a = random(s) * Math.PI * 2;
        for (let i = 0; i < count; i++) {
            const angle = a + (i - count / 2) * .12, rad = Math.min(rush.initialRadius - 1, rush.radius + 1.5), pos = freePosition(s, rush.center.x + Math.cos(angle) * rad, rush.center.y + Math.sin(angle) * rad);
            const type: UnitId = rush.wave >= 7 && i % 5 === 0 ? 'cavalry' : rush.wave >= 3 && i % 3 === 0 ? 'archer' : i % 2 === 0 ? 'swordsman' : 'spearman';
            const enemy = spawnEntity(s, 1, 'unit', type, pos.x, pos.y);
            enemy.maxHp *= .62 + Math.min(.3, rush.wave * .02);
            enemy.hp = enemy.maxHp;
            enemy.damage *= .67;
            enemy.vision = 40;
            setOrder(enemy, { type: 'attack', targetId: commander.id });
        }
        emit(s, { type: 'alert', x: rush.center.x, y: rush.center.y, team: 0, text: `Wave ${rush.wave} · ${count} raiders incoming` });
    }
    if (s.time >= rush.nextSupplyAt) {
        rush.nextSupplyAt = s.time + 22;
        const a = random(s) * Math.PI * 2, r = Math.max(2, rush.radius * .6), pos = freePosition(s, rush.center.x + Math.cos(a) * r, rush.center.y + Math.sin(a) * r);
        const kind = rush.wave % 3 === 0 ? 'heal' : random(s) < .5 ? 'reinforcements' : 'charge';
        rush.supplies.push({ id: `supply-${s.nextId++}`, ...pos, kind, expiresAt: s.time + 45 });
        emit(s, { type: 'spawn', ...pos, team: 0, subtype: 'supply' });
    }
    for (const pickup of rush.supplies) {
        if (distance(commander, pickup) < 1.4) {
            if (pickup.kind === 'heal')
                for (const ally of s.entities)
                    if (ally.team === 0 && living(ally))
                        ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * .4);
            if (pickup.kind === 'charge')
                for (const id of Object.keys(commander.abilityCooldowns))
                    commander.abilityCooldowns[id] = 0;
            if (pickup.kind === 'reinforcements') {
                const type: UnitId = random(s) < .5 ? 'archer' : 'spearman';
                spawnEntity(s, 0, 'unit', type, commander.x + 1, commander.y + 1);
                spawnEntity(s, 0, 'unit', 'swordsman', commander.x - 1, commander.y + 1);
            }
            pickup.expiresAt = 0;
            emit(s, { type: 'capture', x: pickup.x, y: pickup.y, team: 0, subtype: pickup.kind, text: pickup.kind === 'heal' ? 'Supply cache: squad restored' : pickup.kind === 'charge' ? 'Supply cache: abilities ready' : 'Supply cache: reinforcements joined' });
        }
    }
    rush.supplies = rush.supplies.filter(p => p.expiresAt > s.time);
    if (s.time >= rush.nextUpgradeAt && rush.nextUpgradeAt < rush.surviveUntil) {
        rush.nextUpgradeAt += 45;
        rush.upgradeAvailable++;
        offerRushUpgrades(s);
        emit(s, { type: 'alert', x: commander.x, y: commander.y, team: 0, text: 'Field upgrade ready. Choose your advantage!' });
    }
    if (s.time >= rush.nextHazardAt) {
        rush.nextHazardAt = s.time + Math.max(9, 22 - rush.wave * .5);
        rush.hazards.push({ id: `hazard-${s.nextId++}`, x: commander.x, y: commander.y, radius: 2.4, detonateAt: s.time + 2.8 });
        emit(s, { type: 'alert', x: commander.x, y: commander.y, team: 0, text: 'Runic strike incoming. Move out of the marked circle!' });
    }
    for (const hazard of rush.hazards)
        if (s.time >= hazard.detonateAt) {
            for (const e of s.entities)
                if (living(e) && distance(e, hazard) < hazard.radius)
                    rushDamage(s, e, e.team === 0 ? 100 : 80);
            emit(s, { type: 'ability', x: hazard.x, y: hazard.y, team: 1, subtype: 'trap', value: hazard.radius });
        }
    rush.hazards = rush.hazards.filter(h => s.time < h.detonateAt);
}
/** Reject a placement that would newly strand friendly troops behind its footprint. */
function preservesAccess(s: GameState, team: number, x: number, y: number, radius: number): boolean {
    const old = blockers(s), blocked = new Set(old);
    for (let yy = Math.floor(y - radius); yy <= Math.floor(y + radius); yy++)
        for (let xx = Math.floor(x - radius); xx <= Math.floor(x + radius); xx++)
            if (Math.hypot(xx + .5 - x, yy + .5 - y) < radius + .25)
                blocked.add(yy * s.map.width + xx);
    const center = { x: s.map.width / 2 + .5, y: s.map.height / 2 + .5 };
    let root = tileIndex(s.map, center.x, center.y);
    if (!isWalkable(s.map, center.x, center.y) || blocked.has(root)) {
        root = s.map.tiles.findIndex((_, i) => isWalkable(s.map, i % s.map.width, Math.floor(i / s.map.width)) && !blocked.has(i));
    }
    if (root < 0)
        return false;
    function flood(walls: Set<number>) {
        const seen = new Set<number>([root]), q = [root];
        for (let head = 0; head < q.length; head++) {
            const i = q[head], cx = i % s.map.width, cy = Math.floor(i / s.map.width);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = cx + dx, ny = cy + dy, index = ny * s.map.width + nx;
                if (!walls.has(index) && !seen.has(index) && isWalkable(s.map, nx, ny)) {
                    seen.add(index);
                    q.push(index);
                }
            }
        }
        return seen;
    }
    const after = flood(blocked), before = flood(old);
    for (const tile of before)
        if (!blocked.has(tile) && !after.has(tile))
            return false;
    return true;
}
