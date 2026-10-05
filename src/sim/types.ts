import type { MapScenario } from './scenario-types';
/** Serializable, presentation-free simulation contract. Coordinates are tile units. */
export type TeamId = number;
export interface Point {
    x: number;
    y: number;
}
export type TerrainType = 'grass' | 'forest' | 'water' | 'rock' | 'sand' | 'snow' | 'road' | 'marsh';
export type BiomeId = 'grasslands' | 'forest' | 'desert' | 'snow';
export type FactionId = 'ironhold' | 'wildborn' | 'arcanists';
export type CommanderId = 'warlord' | 'ranger' | 'engineer';
export type UnitId = 'swordsman' | 'spearman' | 'archer' | 'cavalry' | 'siege' | 'support';
export type BuildingId = 'keep' | 'house' | 'barracks' | 'range' | 'stable' | 'workshop' | 'tower' | 'depot' | 'blacksmith';
export type TechId = 'steel' | 'armor' | 'fletching' | 'economy' | 'logistics' | 'veterancy';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'brutal';
export type AIPersonality = 'aggressive' | 'defensive' | 'economic' | 'raider' | 'expansionist' | 'adaptive';
export type GameMode = 'domination' | 'conquest' | 'relic' | 'rush';
export type MapSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'giant' | 'colossal';
export type MapPreset = 'competitive' | 'balanced' | 'wild' | 'chaotic';
export interface GameSettings {
    seed: string;
    learning?: boolean;
    /** Preserve this together with the seed to reproduce generated layouts. */
    mapGenerationVersion?: 3 | 4 | 5;
    matchScale?: 'quick' | 'standard' | 'epic' | 'custom';
    /** Wall-clock playback rate; simulation commands use game-seconds. */
    gameSpeed?: number;
    /** Deposit income multiplier shared equally by every player. */
    incomeRate?: number;
    /** Density from zero (off) to two (many); generated only by v5. */
    neutralCamps?: number;
    slots?: import('./scenario-types').MapPlayerSlot[];
    biome: BiomeId;
    mapSize: MapSize;
    difficulty: Difficulty;
    commander: CommanderId;
    faction: FactionId;
    mode: GameMode; /** Requested match duration, minutes. */
    duration: number;
    aiPlayers: number; /** Run player zero using AI, useful for headless matches. */
    aiControlPlayer: boolean;
    aiPersonality: AIPersonality;
    populationCap: number;
    startingGold: number;
    startingWood: number;
    resourceAbundance: number;
    terrainRoughness: number;
    water: number;
    objectiveDensity: number;
    weirdness: number;
    preset: MapPreset; /** Optional authored map. */
    customMap?: GameMap;
    modifiers?: GameModifiers;
    /** Mission triggers decide success; losing player zero's keep ends the mission. */
    scriptedVictory?: boolean;
}
export interface PlayerModifiers {
    income?: number;
    captureSpeed?: number;
    damage?: number;
    health?: number;
    startingGold?: number;
    startingWood?: number;
}
export interface GameModifiers {
    income?: number;
    playerDamage?: number;
    playerHealth?: number;
    captureSpeed?: number;
    /** Indexed bonuses; legacy income/captureSpeed remain global. */
    players?: Record<number, PlayerModifiers>;
}
export interface ResourceNode extends Point {
    id: string;
    kind: 'gold' | 'wood' | 'relic';
    owner: TeamId | null;
    captureTeam: TeamId | null;
    captureProgress: number;
    radius: number;
    income: number;
    amount: number;
    maxAmount: number;
}
export interface GameMap {
    name?: string;
    scenario?: MapScenario;
    purpose?: 'arena';
    version: number;
    seed: string;
    biome: BiomeId;
    width: number;
    height: number;
    tiles: TerrainType[];
    spawns: Point[];
    nodes: ResourceNode[];
    validation: MapValidation;
}
export interface MapValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
    reachablePercent: number;
    fairness: number;
}
export interface Cost {
    gold: number;
    wood: number;
}
export interface UnitDefinition {
    id: UnitId;
    name: string;
    description: string;
    cost: Cost;
    hp: number;
    damage: number;
    armor: number;
    range: number;
    speed: number;
    cooldown: number;
    vision: number;
    population: number;
    trainTime: number;
    building: BuildingId;
    counter: Partial<Record<UnitId | 'building', number>>;
}
export interface BuildingDefinition {
    id: BuildingId;
    name: string;
    description: string;
    cost: Cost;
    hp: number;
    buildTime: number;
    size: number;
    vision: number;
    population: number;
    prerequisites: BuildingId[];
    recruits: UnitId[];
    damage?: number;
    range?: number;
}
export interface AbilityDefinition {
    id: string;
    name: string;
    description: string;
    cooldown: number;
    key: string;
}
export interface CommanderDefinition {
    id: CommanderId;
    name: string;
    description: string;
    hp: number;
    damage: number;
    armor: number;
    range: number;
    speed: number;
    vision: number;
    cooldown: number;
    abilities: AbilityDefinition[];
}
export interface FactionDefinition {
    id: FactionId;
    name: string;
    description: string;
    color: string;
    symbol: string;
    damage: number;
    health: number;
    speed: number;
    cost: number;
    buildingHealth: number;
}
export interface TechnologyDefinition {
    id: TechId;
    name: string;
    description: string;
    cost: Cost;
    time: number;
    building: BuildingId;
    maxLevel: number;
}
export interface BiomeDefinition {
    id: BiomeId;
    name: string;
    description: string;
    vision: number;
    speed: number;
    income: number;
    primary: TerrainType;
    colors: Record<TerrainType, string>;
}
export type EntityOrder = {
    type: 'idle' | 'hold';
} | {
    type: 'move' | 'attackMove' | 'capture';
    x: number;
    y: number;
    nodeId?: string;
} | {
    type: 'attack';
    targetId: string;
};
export interface ProductionItem {
    type: 'unit' | 'research' | 'buildingUpgrade';
    id: UnitId | TechId | BuildingId;
    queueId?: string;
    paidCost?: Cost;
    remaining: number;
    total: number;
}
export interface Entity extends Point {
    id: string;
    team: TeamId;
    campId?: string;
    /** Authored neutral camp leash; ordinary guards keep their normal radius. */
    campRadius?: number;
    kind: 'commander' | 'unit' | 'building';
    type: CommanderId | UnitId | BuildingId | 'turret';
    hp: number;
    maxHp: number;
    damage: number;
    armor: number;
    range: number;
    speed: number;
    vision: number;
    attackCooldown: number;
    attackPeriod: number;
    radius: number;
    facing: number;
    order: EntityOrder;
    path: Point[];
    pathTarget: Point | null;
    pathTimer: number;
    targetId: string | null;
    /** Optional slow-unit anchor for a combined-arms attack-move column. */
    escortId?: string;
    /** Idle troops defend within two tiles of this point, then return. */
    guardAnchor?: Point;
    buildProgress: number;
    buildTime: number;
    queue: ProductionItem[];
    buildingLevel?: number;
    directControl?: { x: number; y: number; until: number };
    rally: Point | null;
    abilityCooldowns: Record<string, number>;
    buffUntil: number;
    slowUntil: number;
    invulnerableUntil: number;
    respawnAt: number | null;
    lifetime: number | null;
    lastHitAt: number;
}
export interface PlayerStats {
    unitsCreated: number;
    unitsLost: number;
    kills: number;
    buildingsCreated: number;
    buildingsDestroyed: number;
    goldCollected: number;
    woodCollected: number;
    captures: number;
    commanderDeaths: number;
    damageDealt: number;
    pauses: number;
}
export interface Player {
    team: TeamId;
    alliance?: number;
    neutral?: boolean;
    closed?: boolean;
    difficulty?: Difficulty;
    name: string;
    faction: FactionId;
    commander: CommanderId;
    color: string;
    symbol: string;
    gold: number;
    wood: number;
    population: number;
    populationCap: number;
    maxPopulation: number;
    research: Partial<Record<TechId, number>>;
    score: number;
    defeated: boolean;
    ai: boolean;
    personality: AIPersonality;
    stats: PlayerStats;
    aiNextThink: number;
    aiPhase: string;
    aiRecruitPlan?: UnitId;
    aiAttackUntil?: number;
    aiStageSince?: number;
    aiCommanderRetreat?: boolean;
    lastKnownEnemies: Point[];
}
export interface GameEvent extends Point {
    id: number;
    type: 'attack' | 'projectile' | 'hit' | 'death' | 'spawn' | 'build' | 'capture' | 'ability' | 'heal' | 'victory' | 'alert' | 'dialogue' | 'research';
    time: number;
    team: number;
    targetX?: number;
    targetY?: number;
    /** Actual damage attribution for bounded guard retaliation; absent in older saves. */
    sourceId?: string;
    targetTeam?: TeamId;
    entityId?: string;
    value?: number;
    text?: string;
    subtype?: string;
}
export interface FogState {
    visible: number[][];
    explored: number[][];
}
export type ScriptCondition = {
        type: 'time';
        seconds: number;
    } | {
        type: 'captured';
        nodeId: string;
        team: number;
    } | {
        type: 'resource';
        team: number;
        resource: 'gold' | 'wood';
        amount: number;
    } | {
        type: 'destroyed';
        entityId: string;
    } | {
        type: 'region';
        team: number;
        x: number;
        y: number;
        radius: number;
    } | {
        type: 'all' | 'any';
        conditions: ScriptCondition[];
    } | {
        type: 'owned'; team: number; kind: ResourceNode['kind']; count: number;
    } | {
        type: 'units'; team: number; unit?: UnitId; count: number;
    } | {
        type: 'buildings'; team: number; building?: BuildingId; count: number;
    } | {
        type: 'stat'; team: number; stat: keyof PlayerStats; amount: number;
    } | {
        type: 'teamDefeated'; team: number;
    } | {
        type: 'research'; team: number; technology: TechId; level: number;
    } | {
        type: 'entityLocation'; entityId: string; x: number; y: number; radius: number;
    };
export interface ScriptTrigger {
    id: string;
    when: ScriptCondition;
    actions: ScriptAction[];
    fired?: boolean;
}
export type ScriptAction = {
    type: 'dialogue';
    text: string;
    team?: number;
} | {
    type: 'resources';
    team: number;
    gold: number;
    wood: number;
} | {
    type: 'spawn';
    team: number;
    unit: UnitId;
    count: number;
    x: number;
    y: number;
} | {
    type: 'victory';
    team: number;
} | {
    type: 'reveal';
    team: number;
} | {
    type: 'objective';
    text: string;
} | {
    type: 'defeat'; team: number;
} | {
    type: 'alliance'; team: number; alliance: number;
};
export interface NeutralCampState {
    id: string;
    entityIds: string[];
    rewardGold: number;
    rewardWood: number;
    cleared: boolean;
    defeatedBy: number | null;
}
export interface GameState {
    version: number;
    settings: GameSettings;
    map: GameMap;
    rush?: RushState;
    camps?: NeutralCampState[];
    entities: Entity[];
    players: Player[];
    time: number;
    tick: number;
    accumulator: number;
    winner: number | null;
    victoryReason: string;
    paused: boolean;
    pendingCommands: GameCommand[];
    events: GameEvent[];
    fog: FogState;
    nextId: number;
    nextEventId: number;
    rng: number;
    scoreTarget: number;
    escalation: number;
    objectiveText: string;
    triggers: ScriptTrigger[];
    commandLog: {
        tick: number;
        command: GameCommand;
    }[];
    lastFogTick: number;
    navigationVersion: number;
}
export type RushUpgradeId = 'blade' | 'bulwark' | 'fleet' | 'reinforcements' | 'renewal' | 'focus';
export interface RushSupply extends Point {
    id: string;
    kind: 'heal' | 'reinforcements' | 'charge';
    expiresAt: number;
}
export interface RushHazard extends Point {
    id: string;
    radius: number;
    detonateAt: number;
}
export interface RushState {
    center: Point;
    radius: number;
    initialRadius: number;
    surviveUntil: number;
    wave: number;
    nextWaveAt: number;
    nextUpgradeAt: number;
    upgradeAvailable: number;
    offeredUpgrades: RushUpgradeId[];
    upgrades: RushUpgradeId[];
    supplies: RushSupply[];
    hazards: RushHazard[];
    kills: number;
    nextSupplyAt: number;
    nextHazardAt: number;
}
export type GameCommand = {
    type: 'steer';
    team: number;
    dx: number;
    dy: number;
} | {
    type: 'cancelProduction';
    team: number;
    buildingId: string;
    queueId: string;
} | {
    type: 'upgradeBuilding';
    team: number;
    buildingId: string;
} | {
    type: 'upgrade';
    team: number;
    upgrade: RushUpgradeId;
} | {
    type: 'move' | 'attackMove';
    team: number;
    entityIds?: string[];
    x: number;
    y: number;
} | {
    type: 'attack';
    team: number;
    entityIds?: string[];
    targetId: string;
} | {
    type: 'hold';
    team: number;
    entityIds?: string[];
} | {
    type: 'capture';
    team: number;
    entityIds?: string[];
    nodeId: string;
} | {
    type: 'build';
    team: number;
    building: BuildingId;
    x: number;
    y: number;
} | {
    type: 'recruit';
    team: number;
    unit: UnitId;
    buildingId?: string;
    count?: number;
} | {
    type: 'research';
    team: number;
    technology: TechId;
    buildingId?: string;
} | {
    type: 'ability';
    team: number;
    ability: string;
    x?: number;
    y?: number;
    targetId?: string;
} | {
    type: 'rally';
    team: number;
    buildingId: string;
    x: number;
    y: number;
} | {
    type: 'pause';
    team: number;
    paused: boolean;
};
export interface CommandResult {
    ok: boolean;
    error?: string;
    queued?: boolean;
}
