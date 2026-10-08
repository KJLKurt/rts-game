import type {
  CommanderId,
  FactionId,
  GameMode,
  GameSettings,
  GameState,
  PlayerStats,
} from "../../sim/types";
import {
  canPlayerContinue,
  hasPlayerSurrendered,
  playerAllianceWon,
  playerOutcomeStatus,
} from "../../sim/alliances";
import { battleResultReason } from "../results";

export type AchievementCategory =
  | "milestones"
  | "economy"
  | "tactics"
  | "commanders"
  | "stories"
  | "challenges";
export interface AchievementRecord {
  progress: number;
  unlocked: boolean;
  unlockedAt: string | null;
}
export interface UsageRecord {
  games: number;
  wins: number;
  seconds: number;
}
export interface MatchRecord {
  id: string;
  endedAt: string;
  victory: boolean;
  seconds: number;
  faction: FactionId;
  commander: CommanderId;
  mode: GameMode;
  difficulty: GameSettings["difficulty"];
  biome: GameSettings["biome"];
  seed: string;
  reason: string;
  campaignId?: string;
  missionId?: string;
  expeditionNode?: string;
  stats: PlayerStats;
}
export interface ProfileV2 {
  version: 2;
  games: number;
  wins: number;
  seconds: number;
  kills: number;
  streak: number;
  bestStreak: number;
  campaign: number;
  campaignProgress: Record<string, number>;
  completedMissions: Record<string, string[]>;
  expedition: number;
  unlocked: string[];
  achievements: Record<string, AchievementRecord>;
  totals: PlayerStats;
  best: Record<string, number>;
  factionUsage: Record<FactionId, UsageRecord>;
  commanderUsage: Record<CommanderId, UsageRecord>;
  fastestVictory: number | null;
  history: MatchRecord[];
  recordedMatchIds: string[];
  choices: string[];
  selectedBanner: string;
}
export interface BattleContext {
  matchId: string;
  endedAt?: string;
  campaignId?: string;
  missionId?: string;
  missionIndex?: number;
  campaignLength?: number;
  expeditionNode?: string;
  expeditionCompleted?: boolean;
  unlocks?: string[];
}
export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  target: number;
  hidden?: boolean;
  metric: (profile: ProfileV2) => number;
}
export const STAT_KEYS: (keyof PlayerStats)[] = [
  "unitsCreated",
  "unitsLost",
  "kills",
  "buildingsCreated",
  "buildingsDestroyed",
  "goldCollected",
  "woodCollected",
  "captures",
  "commanderDeaths",
  "damageDealt",
  "pauses",
];
const emptyStats = (): PlayerStats =>
  Object.fromEntries(
    STAT_KEYS.map((key) => [key, 0]),
  ) as unknown as PlayerStats;
const emptyUsage = (): UsageRecord => ({ games: 0, wins: 0, seconds: 0 });
const n = (value: unknown, max = 1e12) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(max, value))
    : 0;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const strings = (value: unknown, max = 200) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (v): v is string =>
              typeof v === "string" && /^[a-zA-Z0-9:_-]{1,150}$/.test(v),
          ),
        ),
      ].slice(0, max)
    : [];
const date = (value: unknown): string | null =>
  typeof value === "string" &&
  /^\d{4}-\d\d-\d\dT/.test(value) &&
  Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
export function createProfile(): ProfileV2 {
  return {
    version: 2,
    games: 0,
    wins: 0,
    seconds: 0,
    kills: 0,
    streak: 0,
    bestStreak: 0,
    campaign: 0,
    campaignProgress: {},
    completedMissions: {},
    expedition: 0,
    unlocked: [],
    achievements: {},
    totals: emptyStats(),
    best: {},
    factionUsage: {
      ironhold: emptyUsage(),
      wildborn: emptyUsage(),
      arcanists: emptyUsage(),
    },
    commanderUsage: {
      warlord: emptyUsage(),
      ranger: emptyUsage(),
      engineer: emptyUsage(),
    },
    fastestVictory: null,
    history: [],
    recordedMatchIds: [],
    choices: ["banner-frontier"],
    selectedBanner: "banner-frontier",
  };
}
export const PERSISTENT_CHOICES = [
  {
    id: "banner-frontier",
    kind: "cosmetic",
    title: "Frontier Commander",
    description: "Your original command-record title.",
    requirement: "Available from the start.",
  },
  {
    id: "banner-founder",
    kind: "cosmetic",
    title: "Founder of the Frontier",
    description: "A command-record title for completing The Outpost.",
    requirement: "Complete The Outpost.",
  },
  {
    id: "banner-ironwatch",
    kind: "cosmetic",
    title: "Breaker of Ironwatch",
    description: "A command-record title for mastering the siege.",
    requirement: "Complete Siege of Ironwatch.",
  },
  {
    id: "banner-legend",
    kind: "cosmetic",
    title: "Legend of the Frontier",
    description: "A command-record title for completing Rise of the Frontier.",
    requirement: "Complete Rise of the Frontier.",
  },
  {
    id: "banner-wayfinder",
    kind: "cosmetic",
    title: "Wayfinder",
    description: "A command-record title for completing an expedition.",
    requirement: "Complete an expedition.",
  },
  {
    id: "banner-warden",
    kind: "cosmetic",
    title: "Warden of the Ember Road",
    description: "A command-record title for completing the second story.",
    requirement: "Complete The Ember Road.",
  },
  {
    id: "loadout-forager",
    kind: "expedition",
    title: "Forager's charter",
    description:
      "Expedition choice: +100 wood and −40 gold per battle. No change to skirmishes.",
    requirement: "Complete Hold the Line.",
  },
  {
    id: "loadout-vanguard",
    kind: "expedition",
    title: "Vanguard's oath",
    description:
      "Expedition choice: +10% damage and −8% health. No change to skirmishes.",
    requirement: "Complete Broken Alliance.",
  },
  {
    id: "challenge-iron-oath",
    kind: "challenge",
    title: "Iron Oath",
    description:
      "An optional Brutal conquest battle: tactical pause is disabled.",
    requirement: "Complete Rise of the Frontier or win a Hard/Brutal battle.",
  },
] as const;
const metric = (key: string) => (profile: ProfileV2) => profile.best[key] ?? 0;
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "first-victory",
    name: "First Light",
    description: "Win your first battle.",
    category: "milestones",
    target: 1,
    metric: (p) => p.wins,
  },
  {
    id: "veteran",
    name: "Veteran",
    description: "Play five battles.",
    category: "milestones",
    target: 5,
    metric: (p) => p.games,
  },
  {
    id: "conqueror",
    name: "Conqueror",
    description: "Win five battles.",
    category: "milestones",
    target: 5,
    metric: (p) => p.wins,
  },
  {
    id: "legend",
    name: "Frontier Legend",
    description: "Complete all five chapters of Rise of the Frontier.",
    category: "stories",
    target: 5,
    metric: (p) => p.campaign,
  },
  {
    id: "streak",
    name: "Unbroken",
    description: "Win three battles in a row.",
    category: "milestones",
    target: 3,
    metric: (p) => p.bestStreak,
  },
  {
    id: "century",
    name: "A Hundred Banners",
    description: "Defeat 100 units across battles.",
    category: "milestones",
    target: 100,
    metric: (p) => p.kills,
  },
  {
    id: "thousand",
    name: "An Army Falls",
    description: "Defeat 1,000 units across battles.",
    category: "milestones",
    target: 1000,
    metric: (p) => p.kills,
  },
  {
    id: "hour",
    name: "Watchful Commander",
    description: "Spend one hour on the battlefield.",
    category: "milestones",
    target: 3600,
    metric: (p) => p.seconds,
  },
  {
    id: "capture",
    name: "Stake Your Claim",
    description: "Capture a resource point.",
    category: "economy",
    target: 1,
    metric: (p) => p.totals.captures,
  },
  {
    id: "builder",
    name: "Foundations",
    description:
      "Field five buildings in one battle, including your starting settlement.",
    category: "economy",
    target: 5,
    metric: metric("buildingsCreated"),
  },
  {
    id: "recruiter",
    name: "Raise the Banner",
    description: "Field twenty units in one battle, including starting troops.",
    category: "economy",
    target: 20,
    metric: metric("unitsCreated"),
  },
  {
    id: "economist",
    name: "Golden Age",
    description: "Collect 2,000 gold in one battle.",
    category: "economy",
    target: 2000,
    metric: metric("goldCollected"),
  },
  {
    id: "woodsman",
    name: "Deep Roots",
    description: "Collect 2,000 wood in one battle.",
    category: "economy",
    target: 2000,
    metric: metric("woodCollected"),
  },
  {
    id: "tactician",
    name: "Time to Think",
    description: "Use tactical pause.",
    category: "tactics",
    target: 1,
    metric: (p) => p.totals.pauses,
  },
  {
    id: "siege",
    name: "Stonebreaker",
    description: "Win a conquest battle.",
    category: "tactics",
    target: 1,
    metric: metric("conquestWins"),
  },
  ...(["warlord", "ranger", "engineer"] as const).map((id, i) => ({
    id,
    name: ["Iron Will", "True Shot", "Built to Last"][i],
    description: `Win as the ${["Warlord", "Ranger", "Engineer"][i]}.`,
    category: "commanders" as const,
    target: 1,
    metric: (p: ProfileV2) => p.commanderUsage[id].wins,
  })),
  {
    id: "hard",
    name: "Against the Odds",
    description: "Win on Hard or Brutal difficulty.",
    category: "challenges",
    target: 1,
    metric: metric("hardWins"),
  },
  {
    id: "expedition",
    name: "Wayfinder",
    description: "Complete a branching expedition.",
    category: "stories",
    target: 1,
    metric: (p) => p.expedition,
  },
  {
    id: "quick",
    name: "Lightning Victory",
    description: "Win in under eight minutes.",
    category: "challenges",
    target: 1,
    metric: metric("quickWins"),
  },
  {
    id: "survivor",
    name: "Unscathed",
    description: "Win without losing your commander.",
    category: "tactics",
    target: 1,
    metric: metric("survivorWins"),
  },
  {
    id: "no-pause",
    name: "Steady Hands",
    description: "Win without tactical pause.",
    category: "challenges",
    target: 1,
    metric: metric("noPauseWins"),
  },
  {
    id: "huge",
    name: "A Wider World",
    description: "Win a Huge-map battle.",
    category: "challenges",
    target: 1,
    metric: metric("hugeWins"),
  },
  {
    id: "all-supplies",
    name: "Every Road Is Ours",
    description: "Own every gold and wood deposit when you win.",
    category: "tactics",
    target: 1,
    metric: metric("allSuppliesWins"),
  },
  {
    id: "cavalry",
    name: "Thunder of Hooves",
    description:
      "Win with at least six cavalry making up 60% of your surviving troops.",
    category: "tactics",
    target: 1,
    metric: metric("cavalryWins"),
  },
  {
    id: "all-factions",
    name: "Three Banners",
    description: "Win once with each faction.",
    category: "commanders",
    target: 3,
    metric: (p) =>
      Object.values(p.factionUsage).filter((usage) => usage.wins > 0).length,
  },
  {
    id: "ember-road",
    name: "The Road Remembers",
    description: "Complete all three chapters of The Ember Road.",
    category: "stories",
    target: 3,
    metric: (p) => p.campaignProgress["ember-road"] ?? 0,
  },
  {
    id: "last-banner",
    name: "One Last Breath",
    description: "Win while your surviving commander has at most 10% health.",
    category: "challenges",
    target: 1,
    hidden: true,
    metric: metric("lastBannerWins"),
  },
  {
    id: "master-builder",
    name: "A Lasting Settlement",
    description: "Create 100 buildings across battles.",
    category: "economy",
    target: 100,
    metric: (p) => p.totals.buildingsCreated,
  },
];
export function migrateProfile(input: unknown): ProfileV2 {
  const raw = object(input),
    profile = createProfile();
  for (const key of [
    "games",
    "wins",
    "seconds",
    "kills",
    "streak",
    "bestStreak",
    "campaign",
    "expedition",
  ] as const)
    profile[key] = n(raw[key]);
  profile.wins = Math.min(profile.games, profile.wins);
  profile.bestStreak = Math.max(profile.streak, profile.bestStreak);
  for (const [key, value] of Object.entries(object(raw.campaignProgress)).slice(
    0,
    100,
  ))
    if (/^[a-z0-9-]{1,100}$/.test(key))
      profile.campaignProgress[key] = n(value, 1000);
  profile.campaignProgress["rise-of-the-frontier"] = Math.max(
    profile.campaign,
    profile.campaignProgress["rise-of-the-frontier"] ?? 0,
  );
  profile.campaign = profile.campaignProgress["rise-of-the-frontier"];
  for (const [key, value] of Object.entries(
    object(raw.completedMissions),
  ).slice(0, 100))
    if (/^[a-z0-9-]{1,100}$/.test(key))
      profile.completedMissions[key] = strings(value, 100);
  // Convert legacy linear indices once; future graph saves use explicit IDs.
  if (
    !Object.hasOwn(profile.completedMissions, "rise-of-the-frontier") &&
    profile.campaign > 0
  )
    profile.completedMissions["rise-of-the-frontier"] = [
      "outpost",
      "hold-line",
      "broken-alliance",
      "ironwatch",
      "frontier",
    ].slice(0, profile.campaign);
  const totals = object(raw.totals);
  for (const key of STAT_KEYS) profile.totals[key] = n(totals[key]);
  profile.totals.kills = Math.max(profile.kills, profile.totals.kills);
  for (const [key, value] of Object.entries(object(raw.best)).slice(0, 100))
    if (/^[a-zA-Z]{1,50}$/.test(key)) profile.best[key] = n(value);
  for (const field of ["factionUsage", "commanderUsage"] as const) {
    const usage = object(raw[field]);
    for (const key of Object.keys(profile[field])) {
      const item = object(usage[key]);
      (profile[field] as Record<string, UsageRecord>)[key] = {
        games: n(item.games),
        wins: Math.min(n(item.games), n(item.wins)),
        seconds: n(item.seconds),
      };
    }
  }
  profile.fastestVictory =
    typeof raw.fastestVictory === "number" &&
    raw.fastestVictory > 0 &&
    Number.isFinite(raw.fastestVictory)
      ? raw.fastestVictory
      : null;
  const known = new Set(
    ACHIEVEMENT_DEFINITIONS.map((achievement) => achievement.id),
  );
  profile.unlocked = strings(raw.unlocked).filter((id) => known.has(id));
  const achievements = object(raw.achievements);
  for (const definition of ACHIEVEMENT_DEFINITIONS) {
    const old = object(achievements[definition.id]),
      unlocked =
        old.unlocked === true || profile.unlocked.includes(definition.id);
    profile.achievements[definition.id] = {
      progress: Math.min(
        definition.target,
        Math.max(
          n(old.progress),
          definition.metric(profile),
          unlocked ? definition.target : 0,
        ),
      ),
      unlocked,
      unlockedAt: unlocked ? date(old.unlockedAt) : null,
    };
    if (unlocked && !profile.unlocked.includes(definition.id))
      profile.unlocked.push(definition.id);
  }
  profile.recordedMatchIds = strings(raw.recordedMatchIds, 100);
  const choiceIds = new Set<string>(
    PERSISTENT_CHOICES.map((choice) => choice.id),
  );
  profile.choices = [
    ...new Set([
      "banner-frontier",
      ...strings(raw.choices).filter((id) => choiceIds.has(id)),
    ]),
  ];
  if (profile.campaign >= 1) profile.choices.push("banner-founder");
  if (profile.campaign >= 2) profile.choices.push("loadout-forager");
  if (profile.campaign >= 3) profile.choices.push("loadout-vanguard");
  if (profile.campaign >= 4) profile.choices.push("banner-ironwatch");
  if (profile.campaign >= 5)
    profile.choices.push("banner-legend", "challenge-iron-oath");
  if (profile.expedition > 0) profile.choices.push("banner-wayfinder");
  if (profile.unlocked.includes("hard"))
    profile.choices.push("challenge-iron-oath");
  if ((profile.campaignProgress["ember-road"] ?? 0) >= 3)
    profile.choices.push("banner-warden");
  profile.choices = [...new Set(profile.choices)];
  if (
    typeof raw.selectedBanner === "string" &&
    profile.choices.includes(raw.selectedBanner) &&
    PERSISTENT_CHOICES.some(
      (choice) =>
        choice.id === raw.selectedBanner && choice.kind === "cosmetic",
    )
  )
    profile.selectedBanner = raw.selectedBanner;
  if (Array.isArray(raw.history))
    for (const value of raw.history.slice(0, 50)) {
      const entry = object(value),
        endedAt = date(entry.endedAt);
      if (
        !endedAt ||
        typeof entry.id !== "string" ||
        !strings([entry.id]).length ||
        typeof entry.seed !== "string" ||
        !["ironhold", "wildborn", "arcanists"].includes(
          String(entry.faction),
        ) ||
        !["warlord", "ranger", "engineer"].includes(String(entry.commander)) ||
        !["conquest", "domination", "relic", "rush"].includes(
          String(entry.mode),
        ) ||
        !["easy", "normal", "hard", "brutal"].includes(
          String(entry.difficulty),
        ) ||
        !["grasslands", "forest", "desert", "snow"].includes(
          String(entry.biome),
        )
      )
        continue;
      const stats = emptyStats();
      for (const key of STAT_KEYS) stats[key] = n(object(entry.stats)[key]);
      profile.history.push({
        id: entry.id,
        endedAt,
        victory: entry.victory === true,
        seconds: n(entry.seconds),
        faction: entry.faction as FactionId,
        commander: entry.commander as CommanderId,
        mode: entry.mode as GameMode,
        difficulty: entry.difficulty as GameSettings["difficulty"],
        biome: entry.biome as GameSettings["biome"],
        seed: entry.seed.slice(0, 100),
        reason:
          typeof entry.reason === "string" ? entry.reason.slice(0, 500) : "",
        stats,
        ...(typeof entry.campaignId === "string"
          ? { campaignId: entry.campaignId.slice(0, 100) }
          : {}),
        ...(typeof entry.missionId === "string"
          ? { missionId: entry.missionId.slice(0, 100) }
          : {}),
        ...(typeof entry.expeditionNode === "string"
          ? { expeditionNode: entry.expeditionNode.slice(0, 100) }
          : {}),
      });
    }
  return profile;
}

/** A stable saved matchId deduplicates result renders and Continue/reload. */
export function recordBattleResult(
  input: ProfileV2,
  state: GameState,
  context: BattleContext,
): {
  profile: ProfileV2;
  earned: string[];
  choices: string[];
  recorded: boolean;
} {
  const profile = migrateProfile(input);
  if (!strings([context.matchId]).length)
    throw new Error("A stable match ID is required to record the result.");
  const outcome = playerOutcomeStatus(state);
  if (canPlayerContinue(state) || !["won", "lost"].includes(outcome))
    throw new Error(
      "An unfinished battle cannot be added to the command record.",
    );
  if (profile.recordedMatchIds.includes(context.matchId))
    return { profile, earned: [], choices: [], recorded: false };
  const endedAt = date(context.endedAt ?? new Date().toISOString());
  if (!endedAt)
    throw new Error("The result needs a valid completion timestamp.");
  const player = state.players[0],
    win = playerAllianceWon(state),
    stats = emptyStats(),
    beforeChoices = new Set(profile.choices);
  for (const key of STAT_KEYS) {
    stats[key] = n(player.stats[key]);
    profile.totals[key] += stats[key];
    profile.best[key] = Math.max(profile.best[key] ?? 0, stats[key]);
  }
  profile.games++;
  profile.wins += Number(win);
  profile.seconds += n(state.time);
  profile.kills += stats.kills;
  profile.streak = win ? profile.streak + 1 : 0;
  profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
  for (const usage of [
    profile.factionUsage[state.settings.faction],
    profile.commanderUsage[state.settings.commander],
  ]) {
    usage.games++;
    usage.wins += Number(win);
    usage.seconds += n(state.time);
  }
  if (win) {
    if (state.time > 0)
      profile.fastestVictory = Math.min(
        profile.fastestVictory ?? Infinity,
        state.time,
      );
    const test = (key: string, condition: boolean) => {
      if (condition) profile.best[key] = (profile.best[key] ?? 0) + 1;
    };
    const troops = state.entities.filter(
        (entity) =>
          entity.team === 0 && entity.kind === "unit" && entity.hp > 0,
      ),
      cavalry = troops.filter((entity) => entity.type === "cavalry").length;
    const commander = state.entities.find(
        (entity) =>
          entity.team === 0 && entity.kind === "commander" && entity.hp > 0,
      ),
      supplies = state.map.nodes.filter((node) => node.kind !== "relic");
    test("conquestWins", state.settings.mode === "conquest");
    test("hardWins", ["hard", "brutal"].includes(state.settings.difficulty));
    test("quickWins", state.time < 480);
    test("survivorWins", stats.commanderDeaths === 0);
    test("noPauseWins", stats.pauses === 0);
    test("hugeWins", state.settings.mapSize === "huge");
    test(
      "allSuppliesWins",
      supplies.length > 0 && supplies.every((node) => node.owner === 0),
    );
    test("cavalryWins", cavalry >= 6 && cavalry / troops.length >= 0.6);
    test(
      "lastBannerWins",
      !!commander && commander.hp / commander.maxHp <= 0.1,
    );
    if (context.campaignId && context.missionId) {
      const missions = profile.completedMissions[context.campaignId] ?? [];
      profile.completedMissions[context.campaignId] = [
        ...new Set([...missions, context.missionId]),
      ];
      profile.campaignProgress[context.campaignId] =
        profile.completedMissions[context.campaignId].length;
      if (context.campaignId === "rise-of-the-frontier")
        profile.campaign =
          profile.campaignProgress[context.campaignId] ?? profile.campaign;
    }
    if (context.expeditionCompleted) profile.expedition++;
    const knownChoices = new Set<string>(
      PERSISTENT_CHOICES.map((choice) => choice.id),
    );
    profile.choices.push(
      ...(context.unlocks ?? []).filter((id) => knownChoices.has(id)),
    );
    if (context.expeditionCompleted) profile.choices.push("banner-wayfinder");
    if (["hard", "brutal"].includes(state.settings.difficulty))
      profile.choices.push("challenge-iron-oath");
  }
  const earned: string[] = [];
  for (const achievement of ACHIEVEMENT_DEFINITIONS) {
    const record = profile.achievements[achievement.id];
    record.progress = Math.min(
      achievement.target,
      Math.max(record.progress, achievement.metric(profile)),
    );
    // A concession records played stats, but does not grant a new reward.
    if (
      !hasPlayerSurrendered(state) &&
      !record.unlocked &&
      record.progress >= achievement.target
    ) {
      record.unlocked = true;
      record.unlockedAt = endedAt;
      profile.unlocked.push(achievement.id);
      earned.push(achievement.id);
    }
  }
  profile.choices = [...new Set(profile.choices)];
  profile.recordedMatchIds = [
    context.matchId,
    ...profile.recordedMatchIds,
  ].slice(0, 100);
  profile.history.unshift({
    id: context.matchId,
    endedAt,
    victory: win,
    seconds: state.time,
    faction: state.settings.faction,
    commander: state.settings.commander,
    mode: state.settings.mode,
    difficulty: state.settings.difficulty,
    biome: state.settings.biome,
    seed: state.settings.seed,
    reason: battleResultReason(state),
    stats,
    ...(context.campaignId ? { campaignId: context.campaignId } : {}),
    ...(context.missionId ? { missionId: context.missionId } : {}),
    ...(context.expeditionNode
      ? { expeditionNode: context.expeditionNode }
      : {}),
  });
  profile.history = profile.history.slice(0, 50);
  return {
    profile,
    earned,
    choices: profile.choices.filter((id) => !beforeChoices.has(id)),
    recorded: true,
  };
}
export function selectProfileBanner(profile: ProfileV2, id: string): ProfileV2 {
  if (
    !profile.choices.includes(id) ||
    !PERSISTENT_CHOICES.some(
      (choice) => choice.id === id && choice.kind === "cosmetic",
    )
  )
    throw new Error("That command title has not been earned yet.");
  return { ...structuredClone(profile), selectedBanner: id };
}
export function profileBanner(profile: ProfileV2): string {
  return (
    PERSISTENT_CHOICES.find((choice) => choice.id === profile.selectedBanner)
      ?.title ?? "Frontier Commander"
  );
}
export function challengeSettings(
  profile: ProfileV2,
  seed: string,
): Partial<GameSettings> {
  if (!profile.choices.includes("challenge-iron-oath"))
    throw new Error(
      "Complete the story or win a Hard battle to unlock Iron Oath.",
    );
  return {
    seed,
    mode: "conquest",
    difficulty: "brutal",
    mapSize: "medium",
    duration: 18,
    aiPlayers: 1,
  };
}
