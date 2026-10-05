import type {
  BiomeId,
  CommanderId,
  FactionId,
  GameSettings,
  PlayerModifiers,
  ScriptTrigger,
} from "../../sim/types";
import { hashSeed } from "../../sim/maps";
import type { ProfileV2 } from "../progression/profile";

export type ExpeditionNodeKind =
  | "battle"
  | "elite"
  | "village"
  | "shop"
  | "relic"
  | "event"
  | "boss";
export type ExpeditionLoadout = "balanced" | "forager" | "vanguard";
export interface ExpeditionReward {
  crowns?: number;
  gold?: number;
  wood?: number;
  damage?: number;
  health?: number;
}
export interface ExpeditionChoice {
  id: string;
  title: string;
  description: string;
  cost?: number;
  reward: ExpeditionReward;
}
export interface ExpeditionNode {
  id: string;
  tier: number;
  kind: ExpeditionNodeKind;
  title: string;
  description: string;
  next: string[];
  reward?: ExpeditionReward;
  choices?: ExpeditionChoice[];
  biome?: BiomeId;
}
export interface ExpeditionAction {
  nodeId: string;
  choiceId?: string;
  victory?: boolean;
}
export interface ExpeditionSave {
  version: 1;
  seed: string;
  faction: FactionId;
  commander: CommanderId;
  loadout: ExpeditionLoadout;
  journal: ExpeditionAction[];
  activeNode: string | null;
}
export interface ExpeditionRun extends ExpeditionSave {
  phase: "route" | "choice" | "battle" | "completed" | "defeated";
  crowns: number;
  bonuses: Required<Omit<ExpeditionReward, "crowns">>;
  victories: number;
  route: string[];
}
export interface ExpeditionBattle {
  nodeId: string;
  title: string;
  objective: string;
  settings: Partial<GameSettings>;
  triggers: ScriptTrigger[];
}

/** Supplies recur at the start of later battles; only player zero receives rewards. */
export const EXPEDITION_NODES: ExpeditionNode[] = [
  {
    id: "foothold",
    tier: 0,
    kind: "battle",
    title: "The Old Crossing",
    description:
      "Secure the crossing. A victory opens three routes into the frontier.",
    next: ["haven", "caravan", "crossroads"],
    biome: "grasslands",
    reward: { crowns: 90 },
  },
  {
    id: "haven",
    tier: 1,
    kind: "village",
    title: "Haven's Promise",
    description:
      "The village can support one part of your army for the rest of this expedition.",
    next: ["woodland", "redoubt"],
    choices: [
      {
        id: "grain",
        title: "Protect the supply wagons",
        description: "+100 gold at the start of every remaining battle.",
        reward: { gold: 100 },
      },
      {
        id: "timber",
        title: "Reopen the sawmill",
        description: "+130 wood at the start of every remaining battle.",
        reward: { wood: 130 },
      },
      {
        id: "healers",
        title: "Recruit field healers",
        description:
          "+10% health for your army and buildings in every remaining battle.",
        reward: { health: 0.1 },
      },
    ],
  },
  {
    id: "caravan",
    tier: 1,
    kind: "shop",
    title: "The Wandering Caravan",
    description:
      "Spend expedition crowns on one lasting upgrade, or keep your money.",
    next: ["woodland", "redoubt"],
    choices: [
      {
        id: "steel",
        title: "Tempered blades · 70 crowns",
        description:
          "+12% damage for your army and defenses in every remaining battle.",
        cost: 70,
        reward: { damage: 0.12 },
      },
      {
        id: "stores",
        title: "Supply contract · 50 crowns",
        description:
          "+80 gold and +80 wood at the start of every remaining battle.",
        cost: 50,
        reward: { gold: 80, wood: 80 },
      },
      {
        id: "leave",
        title: "Keep your crowns",
        description: "Continue without buying anything.",
        reward: {},
      },
    ],
  },
  {
    id: "crossroads",
    tier: 1,
    kind: "event",
    title: "A Debt on the Road",
    description:
      "A stranded scout offers a choice. Each promise has a clear price.",
    next: ["woodland", "redoubt"],
    choices: [
      {
        id: "escort",
        title: "Escort the scout",
        description:
          "Gain 50 crowns, but start future battles with 30 less wood.",
        reward: { crowns: 50, wood: -30 },
      },
      {
        id: "maps",
        title: "Buy the hidden supply map · 40 crowns",
        description: "+150 gold at the start of every remaining battle.",
        cost: 40,
        reward: { gold: 150 },
      },
      {
        id: "share",
        title: "Share what you can",
        description: "+5% army and building health in future battles. No cost.",
        reward: { health: 0.05 },
      },
    ],
  },
  {
    id: "woodland",
    tier: 2,
    kind: "battle",
    title: "Whisperwood Pass",
    description:
      "A normal battle in close forest. Win 90 crowns and a wood supply bonus.",
    next: ["relic", "refugees"],
    biome: "forest",
    reward: { crowns: 90, wood: 60 },
  },
  {
    id: "redoubt",
    tier: 2,
    kind: "elite",
    title: "Sunscar Redoubt",
    description:
      "Hard enemies defend this exposed desert route. Win 160 crowns and a damage bonus.",
    next: ["relic", "refugees"],
    biome: "desert",
    reward: { crowns: 160, damage: 0.08 },
  },
  {
    id: "relic",
    tier: 3,
    kind: "relic",
    title: "The Three Seals",
    description: "Only one ancient seal can travel with your banner.",
    next: ["ice-road", "iron-gate"],
    choices: [
      {
        id: "ember",
        title: "Ember seal",
        description: "+16% army and defense damage in future battles.",
        reward: { damage: 0.16 },
      },
      {
        id: "oak",
        title: "Oak seal",
        description: "+20% army and building health in future battles.",
        reward: { health: 0.2 },
      },
      {
        id: "river",
        title: "River seal",
        description: "+140 gold and +140 wood at the start of future battles.",
        reward: { gold: 140, wood: 140 },
      },
    ],
  },
  {
    id: "refugees",
    tier: 3,
    kind: "event",
    title: "The Winter Refuge",
    description:
      "Help the people of the pass, or accept their help for the final push.",
    next: ["ice-road", "iron-gate"],
    choices: [
      {
        id: "shelter",
        title: "Build a refuge · 60 crowns",
        description: "+22% army and building health in future battles.",
        cost: 60,
        reward: { health: 0.22 },
      },
      {
        id: "guides",
        title: "Hire the local guides",
        description: "+100 wood at the start of future battles.",
        reward: { wood: 100 },
      },
      {
        id: "tribute",
        title: "Accept donated supplies",
        description:
          "Gain 90 crowns now, but start future battles with 50 less gold.",
        reward: { crowns: 90, gold: -50 },
      },
    ],
  },
  {
    id: "ice-road",
    tier: 4,
    kind: "battle",
    title: "The Ice Road",
    description:
      "Win a relic race in the snow. Earn 100 crowns for your final preparations.",
    next: ["last-village", "last-shop"],
    biome: "snow",
    reward: { crowns: 100 },
  },
  {
    id: "iron-gate",
    tier: 4,
    kind: "elite",
    title: "The Iron Gate",
    description:
      "Break a hard rival's keep. Earn 180 crowns and strengthen your forces.",
    next: ["last-village", "last-shop"],
    biome: "grasslands",
    reward: { crowns: 180, health: 0.1 },
  },
  {
    id: "last-village",
    tier: 5,
    kind: "village",
    title: "The Last Hearth",
    description: "Choose what the final settlement will send to the siege.",
    next: ["citadel"],
    choices: [
      {
        id: "smiths",
        title: "Take the smiths' blessing",
        description: "+10% army and defense damage for the final battle.",
        reward: { damage: 0.1 },
      },
      {
        id: "wagons",
        title: "Take the loaded wagons",
        description: "+150 gold and +200 wood for the final battle.",
        reward: { gold: 150, wood: 200 },
      },
    ],
  },
  {
    id: "last-shop",
    tier: 5,
    kind: "shop",
    title: "Siege Market",
    description:
      "One final purchase. Unspent crowns have no value after the expedition.",
    next: ["citadel"],
    choices: [
      {
        id: "arsenal",
        title: "The complete arsenal · 150 crowns",
        description:
          "+20% army and defense damage and +10% army and building health.",
        cost: 150,
        reward: { damage: 0.2, health: 0.1 },
      },
      {
        id: "stockpile",
        title: "Emergency stockpile · 90 crowns",
        description: "+220 gold and +220 wood for the final battle.",
        cost: 90,
        reward: { gold: 220, wood: 220 },
      },
      {
        id: "leave",
        title: "March on",
        description: "Keep your current preparations.",
        reward: {},
      },
    ],
  },
  {
    id: "citadel",
    tier: 6,
    kind: "boss",
    title: "The Hollow Crown",
    description:
      "Two hard rivals hold the frontier. Destroy both keeps to finish the expedition.",
    next: [],
    biome: "snow",
    reward: {},
  },
];
export const EXPEDITION_LOADOUTS = [
  {
    id: "balanced" as const,
    title: "Founder's banner",
    description: "Start with 40 crowns. No battle modifiers.",
    unlock: null,
  },
  {
    id: "forager" as const,
    title: "Forager's charter",
    description: "+100 wood but −40 gold each battle; start with 40 crowns.",
    unlock: "loadout-forager",
  },
  {
    id: "vanguard" as const,
    title: "Vanguard's oath",
    description:
      "+10% damage but −8% health each battle; start with 40 crowns.",
    unlock: "loadout-vanguard",
  },
];
const nodeById = (id: string) =>
  EXPEDITION_NODES.find((node) => node.id === id);
export const isExpeditionBattle = (node: ExpeditionNode) =>
  ["battle", "elite", "boss"].includes(node.kind);
export function createExpedition(
  seed: string,
  options: Partial<
    Pick<ExpeditionSave, "faction" | "commander" | "loadout">
  > = {},
): ExpeditionRun {
  const loadout = options.loadout ?? "balanced";
  if (
    typeof seed !== "string" ||
    !seed ||
    seed.length > 100 ||
    !EXPEDITION_LOADOUTS.some((value) => value.id === loadout)
  )
    throw new Error("Choose a valid expedition seed and charter.");
  const faction = options.faction ?? "ironhold",
    commander = options.commander ?? "warlord";
  if (
    !["ironhold", "wildborn", "arcanists"].includes(faction) ||
    !["warlord", "ranger", "engineer"].includes(commander)
  )
    throw new Error("Choose a valid faction and commander.");
  return {
    version: 1,
    seed,
    faction,
    commander,
    loadout,
    journal: [],
    activeNode: null,
    phase: "route",
    crowns: 40,
    bonuses: {
      gold: loadout === "forager" ? -40 : 0,
      wood: loadout === "forager" ? 100 : 0,
      damage: loadout === "vanguard" ? 0.1 : 0,
      health: loadout === "vanguard" ? -0.08 : 0,
    },
    victories: 0,
    route: ["foothold"],
  };
}
export function startUnlockedExpedition(
  profile: Pick<ProfileV2, "choices">,
  seed: string,
  options: Partial<
    Pick<ExpeditionSave, "faction" | "commander" | "loadout">
  > = {},
): ExpeditionRun {
  const loadout = EXPEDITION_LOADOUTS.find(
    (item) => item.id === (options.loadout ?? "balanced"),
  );
  if (!loadout || (loadout.unlock && !profile.choices.includes(loadout.unlock)))
    throw new Error(
      "Earn this expedition charter in the story campaign first.",
    );
  return createExpedition(seed, options);
}
export function expeditionOptions(run: ExpeditionRun): ExpeditionNode[] {
  return run.phase === "route"
    ? run.route.map(nodeById).filter((node): node is ExpeditionNode => !!node)
    : [];
}
export function currentExpeditionNode(
  run: ExpeditionRun,
): ExpeditionNode | null {
  return run.activeNode ? (nodeById(run.activeNode) ?? null) : null;
}
export function visitExpeditionNode(
  run: ExpeditionRun,
  id: string,
): ExpeditionRun {
  if (run.phase !== "route" || !run.route.includes(id))
    throw new Error("That stop is not on your available route.");
  return {
    ...structuredClone(run),
    activeNode: id,
    phase: isExpeditionBattle(nodeById(id)!) ? "battle" : "choice",
  };
}
function grant(run: ExpeditionRun, reward: ExpeditionReward) {
  run.crowns += reward.crowns ?? 0;
  for (const stat of ["gold", "wood", "damage", "health"] as const)
    run.bonuses[stat] += reward[stat] ?? 0;
}
function advance(run: ExpeditionRun, node: ExpeditionNode) {
  run.activeNode = null;
  run.route = [...node.next];
  run.phase = node.kind === "boss" ? "completed" : "route";
}
export function chooseExpeditionReward(
  run: ExpeditionRun,
  choiceId: string,
): ExpeditionRun {
  const node = currentExpeditionNode(run),
    choice = node?.choices?.find((value) => value.id === choiceId);
  if (run.phase !== "choice" || !node || !choice)
    throw new Error("Choose an option at your current stop.");
  if (run.crowns < (choice.cost ?? 0))
    throw new Error(`You need ${choice.cost} crowns for this choice.`);
  const next = structuredClone(run);
  next.crowns -= choice.cost ?? 0;
  grant(next, choice.reward);
  next.journal.push({ nodeId: node.id, choiceId });
  advance(next, node);
  return next;
}
export function finishExpeditionBattle(
  run: ExpeditionRun,
  victory: boolean,
): ExpeditionRun {
  const node = currentExpeditionNode(run);
  if (run.phase !== "battle" || !node || !isExpeditionBattle(node))
    throw new Error("No expedition battle is waiting for a result.");
  const next = structuredClone(run);
  next.journal.push({ nodeId: node.id, victory });
  if (!victory) {
    next.phase = "defeated";
    next.route = [];
    next.activeNode = null;
    return next;
  }
  next.victories++;
  grant(next, node.reward ?? {});
  advance(next, node);
  return next;
}
export function expeditionBattle(run: ExpeditionRun): ExpeditionBattle {
  const node = currentExpeditionNode(run);
  if (!node || run.phase !== "battle" || !isExpeditionBattle(node))
    throw new Error("Choose a battle on your route first.");
  const boss = node.kind === "boss",
    elite = node.kind === "elite",
    first = node.tier === 0;
  const mode =
    boss || node.id === "iron-gate"
      ? "conquest"
      : node.id === "ice-road"
        ? "relic"
        : "domination";
  const biomes: BiomeId[] = ["grasslands", "forest", "desert", "snow"];
  const biome = first
    ? biomes[hashSeed(run.seed) % biomes.length]
    : node.biome!;
  const gold = Math.max(0, 230 + run.bonuses.gold),
    wood = Math.max(0, 260 + run.bonuses.wood);
  // Non-negative additive bonuses preserve negative charter tradeoffs without
  // reducing rivals' supplies or waiting for an initial simulation tick.
  const baseGold = Math.min(230, gold),
    baseWood = Math.min(260, wood);
  const enemySupply = {
    startingGold: 230 - baseGold,
    startingWood: 260 - baseWood,
  };
  const players: Record<number, PlayerModifiers> = {
    0: {
      startingGold: gold - baseGold,
      startingWood: wood - baseWood,
      damage: 1 + run.bonuses.damage,
      health: 1 + run.bonuses.health,
    },
    1: enemySupply,
  };
  if (boss) players[2] = enemySupply;
  return {
    nodeId: node.id,
    title: node.title,
    objective:
      mode === "conquest"
        ? `Destroy ${boss ? "both enemy keeps" : "the enemy keep"}.`
        : mode === "relic"
          ? "Hold relics until your victory-point target is reached, or destroy the rival keep."
          : "Capture relics to reach the victory-point target, or destroy the rival keep.",
    settings: {
      seed: `${run.seed}:${node.id}`,
      mapGenerationVersion: 4,
      faction: run.faction,
      commander: run.commander,
      mode,
      biome,
      mapSize: boss ? "medium" : "small",
      difficulty: boss || elite ? "hard" : first ? "easy" : "normal",
      aiPlayers: boss ? 2 : 1,
      duration: boss ? 18 : first ? 8 : 12,
      startingGold: baseGold,
      startingWood: baseWood,
      populationCap: boss ? 80 : 60,
      modifiers: { players },
    },
    triggers: [],
  };
}
export function saveExpedition(run: ExpeditionRun): ExpeditionSave {
  return structuredClone({
    version: run.version,
    seed: run.seed,
    faction: run.faction,
    commander: run.commander,
    loadout: run.loadout,
    journal: run.journal,
    activeNode: run.activeNode,
  });
}
/** Rebuild rewards by replaying a bounded journal. Never trust saved multipliers. */
export function restoreExpedition(value: unknown): ExpeditionRun | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const saved = value as ExpeditionSave;
    if (
      saved.version !== 1 ||
      typeof saved.seed !== "string" ||
      !Array.isArray(saved.journal) ||
      saved.journal.length > 7
    )
      return null;
    let run = createExpedition(saved.seed, saved);
    for (const action of saved.journal) {
      if (
        !action ||
        typeof action !== "object" ||
        typeof action.nodeId !== "string"
      )
        return null;
      run = visitExpeditionNode(run, action.nodeId);
      if (run.phase === "battle") {
        if (
          typeof action.victory !== "boolean" ||
          action.choiceId !== undefined
        )
          return null;
        run = finishExpeditionBattle(run, action.victory);
      } else {
        if (typeof action.choiceId !== "string" || action.victory !== undefined)
          return null;
        run = chooseExpeditionReward(run, action.choiceId);
      }
    }
    if (saved.activeNode !== null) {
      if (typeof saved.activeNode !== "string") return null;
      run = visitExpeditionNode(run, saved.activeNode);
    }
    return run;
  } catch {
    return null;
  }
}
export function expeditionBonusSummary(run: ExpeditionRun): string[] {
  const { gold, wood, damage, health } = run.bonuses,
    sign = (value: number) => `${value >= 0 ? "+" : ""}${Math.round(value)}`;
  return [
    `${run.crowns} crowns`,
    `${sign(gold)} starting gold`,
    `${sign(wood)} starting wood`,
    `${sign(damage * 100)}% damage`,
    `${sign(health * 100)}% health`,
  ];
}
export function validateExpedition(): string[] {
  const errors: string[] = [],
    ids = new Set<string>();
  for (const node of EXPEDITION_NODES) {
    if (ids.has(node.id)) errors.push(`Duplicate expedition node: ${node.id}`);
    ids.add(node.id);
    if (!node.title || !node.description)
      errors.push(`${node.id}: missing visible description.`);
    if (isExpeditionBattle(node) === !!node.choices?.length)
      errors.push(`${node.id}: battle/choice definition is inconsistent.`);
    for (const id of node.next)
      if (nodeById(id)?.tier !== node.tier + 1)
        errors.push(`${node.id}: route must lead to the next tier.`);
    if (!node.next.length && node.kind !== "boss")
      errors.push(`${node.id}: route ends without a boss.`);
    const choices = new Set<string>();
    for (const choice of node.choices ?? []) {
      if (choices.has(choice.id) || !choice.title || !choice.description)
        errors.push(`${node.id}: invalid choice.`);
      choices.add(choice.id);
      if (
        choice.cost !== undefined &&
        (!Number.isFinite(choice.cost) || choice.cost < 0)
      )
        errors.push(`${node.id}: invalid price.`);
    }
    if (node.choices && !node.choices.some((choice) => !choice.cost))
      errors.push(`${node.id}: needs an affordable exit.`);
  }
  return errors;
}
