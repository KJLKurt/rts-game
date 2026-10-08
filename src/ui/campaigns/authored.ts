import type {
  CommanderId,
  FactionId,
  GameSettings,
  ScriptCondition,
  ScriptTrigger,
} from "../../sim/types";
import { MAP_DIMENSIONS } from "../../sim/content";
import { validateTriggers } from "../../sim/validation";
import { PERSISTENT_CHOICES } from "../progression/profile";

export interface MissionObjective {
  id: string;
  title: string;
  description: string;
  condition: ScriptCondition;
  optional?: boolean;
}
export interface AuthoredMission {
  id: string;
  title: string;
  subtitle: string;
  story: string;
  briefing: string;
  tactics?: string[];
  settings: Partial<GameSettings>;
  triggers: ScriptTrigger[];
  objectives: MissionObjective[];
  next: string[];
  reward: string;
  unlocks: string[];
  lessons: string[];
}
export interface AuthoredCampaign {
  id: string;
  title: string;
  description: string;
  faction: FactionId;
  commander: CommanderId;
  entry: string;
  missions: AuthoredMission[];
}
const owned = (
  kind: "gold" | "wood" | "relic",
  count = 1,
): ScriptCondition => ({ type: "owned", team: 0, kind, count });
const building = (
  id: "house" | "tower" | "workshop" | "depot",
  count = 1,
): ScriptCondition => ({ type: "buildings", team: 0, building: id, count });
const units = (
  count: number,
  unit?: "spearman" | "siege" | "support",
): ScriptCondition => ({
  type: "units",
  team: 0,
  count,
  ...(unit ? { unit } : {}),
});
const stat = (
  key: "goldCollected" | "woodCollected" | "kills",
  amount: number,
): ScriptCondition => ({ type: "stat", team: 0, stat: key, amount });
const objective = (
  id: string,
  title: string,
  description: string,
  condition: ScriptCondition,
  optional = false,
): MissionObjective => ({
  id,
  title,
  description,
  condition,
  ...(optional ? { optional: true } : {}),
});
const dialogue = (
  id: string,
  seconds: number,
  text: string,
): ScriptTrigger => ({
  id,
  when: { type: "time", seconds },
  actions: [{ type: "dialogue", text }],
});
/** Required visible objectives compile directly into the simulation victory rule. */
export function defineMission(
  value: Omit<AuthoredMission, "triggers"> & { triggers?: ScriptTrigger[] },
): AuthoredMission {
  const result = {
    ...value,
    settings: { ...value.settings, scriptedVictory: true },
    triggers: value.triggers ?? [],
  };
  result.triggers = [
    ...result.triggers,
    {
      id: "mission-complete",
      when: {
        type: "all",
        conditions: value.objectives
          .filter((item) => !item.optional)
          .map((item) => item.condition),
      },
      actions: [{ type: "victory", team: 0 }],
    },
  ];
  return result;
}
export const FRONTIER_CAMPAIGN: AuthoredCampaign = {
  id: "rise-of-the-frontier",
  title: "Rise of the Frontier",
  description:
    "Five chapters teach supplies, settlement, defenses, diplomacy, and siege. Complete the listed objectives to win; ordinary score cannot skip a lesson.",
  faction: "ironhold",
  commander: "warlord",
  entry: "outpost",
  missions: [
    defineMission({
      id: "outpost",
      title: "The Outpost",
      subtitle: "01 · A foothold",
      story:
        "Captain Vale's wagon stops where the old road ends. The settlers need a gold mine, a timber camp, and a banner they can follow. You have enough soldiers to begin. Bring them home to something worth defending.",
      briefing:
        "Control a gold mine, a timber camp, and a relic. Complete one house and field six living troops. Keep your Command Keep standing.",
      settings: {
        seed: "OUTPOST-01",
        biome: "grasslands",
        mapSize: "tiny",
        difficulty: "easy",
        duration: 8,
        mode: "domination",
        aiPlayers: 1,
        faction: "ironhold",
        commander: "warlord",
        startingGold: 340,
        startingWood: 300,
        objectiveDensity: 1,
      },
      objectives: [
        objective(
          "gold",
          "Control a gold mine",
          "Gold arrives automatically while your banner holds the deposit. No workers are needed.",
          owned("gold"),
        ),
        objective(
          "wood",
          "Control a timber camp",
          "Wood pays for houses, production buildings, and ranged troops.",
          owned("wood"),
        ),
        objective(
          "house",
          "Complete a house",
          "Build beside the settlement to make room for the army.",
          building("house"),
        ),
        objective(
          "army",
          "Field six living troops",
          "Your four starting soldiers count. Train at least two more and keep six alive.",
          units(6),
        ),
        objective(
          "relic",
          "Control a relic",
          "Select Army and send it to the relic. Hold it together with your supplies.",
          owned("relic"),
        ),
      ],
      triggers: [
        dialogue(
          "welcome",
          4,
          "Vale: First the gold, then the timber. Once our banner is raised, each deposit works without us.",
        ),
        {
          id: "wagon",
          when: { type: "time", seconds: 75 },
          actions: [
            { type: "resources", team: 0, gold: 120, wood: 100 },
            {
              type: "dialogue",
              text: "Vale: The wagon is here. Build a house, train two more soldiers, and bring six troops to the relic.",
            },
          ],
        },
      ],
      next: ["hold-line"],
      reward: "Founder title and Hold the Line",
      unlocks: ["banner-founder"],
      lessons: ["Capture income", "Production", "Population", "Relic control"],
    }),
    defineMission({
      id: "hold-line",
      title: "Hold the Line",
      subtitle: "02 · The long night",
      story:
        "The settlers can leave only when the dawn convoy arrives. Raiders move between the trees. Build a defense the enemy cannot pull apart, then keep enough soldiers alive to escort the wagons.",
      briefing:
        "Survive six minutes with two completed towers and three living spearmen. Your keep must survive. Relic score does not end this defense mission.",
      settings: {
        seed: "HOLD-LINE-02",
        biome: "forest",
        mapSize: "small",
        difficulty: "normal",
        aiPersonality: "aggressive",
        duration: 12,
        mode: "domination",
        aiPlayers: 1,
        faction: "ironhold",
        commander: "warlord",
        startingGold: 360,
        startingWood: 480,
      },
      objectives: [
        objective(
          "dawn",
          "Survive until dawn · 6:00",
          "The convoy departs after six minutes of battle time.",
          { type: "time", seconds: 360 },
        ),
        objective(
          "towers",
          "Keep two completed towers standing",
          "Towers cover your approach. Protect them with troops.",
          building("tower", 2),
        ),
        objective(
          "spears",
          "Keep three spearmen alive",
          "Spearmen guard towers and archers against cavalry.",
          units(3, "spearman"),
        ),
        objective(
          "supply-line",
          "Optional: hold gold and timber",
          "Capture both kinds of deposit so your defense can replace losses.",
          { type: "all", conditions: [owned("gold"), owned("wood")] },
          true,
        ),
      ],
      triggers: [
        dialogue(
          "warning",
          50,
          "Scout: Riders in the trees. Keep spearmen in front and towers behind them.",
        ),
        {
          id: "dawn-supplies",
          when: { type: "time", seconds: 180 },
          actions: [
            { type: "resources", team: 0, gold: 200, wood: 150 },
            {
              type: "dialogue",
              text: "Vale: Halfway to dawn. Repair your line by replacing any fallen tower or spearman.",
            },
          ],
        },
      ],
      next: ["broken-alliance"],
      reward: "Forager expedition charter and Broken Alliance",
      unlocks: ["loadout-forager"],
      lessons: ["Counters", "Tower defense", "Survival objectives"],
    }),
    defineMission({
      id: "broken-alliance",
      title: "Broken Alliance",
      subtitle: "03 · Ash and oaths",
      story:
        "An Arcanist envoy swears to keep the eastern road safe for three minutes. Beyond that, no oath is certain. Use the truce to gather gold, move through the dunes, and occupy the beacons before the fragile alliance ends.",
      briefing:
        "Collect 1,200 gold and control two relics after the three-minute truce ends. Rival 2 begins as your ally, then becomes hostile at 3:00.",
      tactics: [
        "Claim another gold mine and timber camp during the truce. Set a fixed rally point near home before your commander scouts. Allied deposits and relics stay under Rival 2’s banner until the truce ends.",
        "Eight troops is an optional milestone, not a force target for the final push. Grow your income and army; use infantry to screen archers and keep Menders behind them.",
        "In Orders, turn Keep distance on so your ranged troops step back between shots when melee troops approach. Research Farshot for extra range. Use Attack-move to clear the approach, then capture. Move and Hold always take priority over spacing.",
        "Rival 2 is led by an Arcanist Engineer who can heal nearby groups. Use Ranger’s Trap on packed troops and focus reachable healers. Siege outranges stock archers; avoid a frontal charge into a larger mixed army.",
      ],
      settings: {
        seed: "ALLIANCE-03",
        biome: "desert",
        mapSize: "medium",
        aiPlayers: 2,
        difficulty: "normal",
        commander: "ranger",
        faction: "wildborn",
        duration: 15,
        mode: "relic",
        objectiveDensity: 1.5,
      },
      objectives: [
        objective(
          "truce",
          "Reach the end of the truce · 3:00",
          "Rival 2 joins your alliance at the opening and leaves at three minutes.",
          { type: "time", seconds: 180 },
        ),
        objective(
          "gold",
          "Collect 1,200 gold",
          "This counts gold earned during battle, not your starting purse. You may spend it.",
          stat("goldCollected", 1200),
        ),
        objective(
          "beacons",
          "Control two relics",
          "Both beacons must fly your banner when the other objectives are complete.",
          owned("relic", 2),
        ),
        objective(
          "scouts",
          "Optional: field eight troops",
          "An early milestone, not a target army size for the final push. Grow a mixed army as your income rises.",
          units(8),
          true,
        ),
      ],
      triggers: [
        {
          id: "truce-begins",
          when: { type: "time", seconds: 0 },
          actions: [
            { type: "alliance", team: 2, alliance: 0 },
            {
              type: "dialogue",
              text: "Envoy: The eastern road is yours for three minutes. After that, every banner stands alone.",
            },
          ],
        },
        {
          id: "truce-ends",
          when: { type: "time", seconds: 180 },
          actions: [
            { type: "alliance", team: 2, alliance: 2 },
            {
              type: "dialogue",
              text: "Scout: The oath is broken. Rival 2 is hostile now. Secure both beacons!",
            },
          ],
        },
      ],
      next: ["ironwatch"],
      reward: "Vanguard expedition oath and Siege of Ironwatch",
      unlocks: ["loadout-vanguard"],
      lessons: ["Ranger mobility", "Alliances", "Multiple objectives"],
    }),
    defineMission({
      id: "ironwatch",
      title: "Siege of Ironwatch",
      subtitle: "04 · Break the gate",
      story:
        "Ironwatch has outlasted a hundred winters. Its commander trusts the walls more than the people behind them. An Engineer knows every wall has a weak point. Build the workshop, escort the siege, and choose where the line will break.",
      briefing:
        "Destroy Rival 1's Command Keep. Build a workshop and escort siege engines for the intended approach; those preparation tasks are optional.",
      settings: {
        seed: "IRONWATCH-04",
        biome: "snow",
        mapSize: "medium",
        difficulty: "hard",
        commander: "engineer",
        faction: "ironhold",
        startingGold: 500,
        startingWood: 500,
        mode: "conquest",
        duration: 18,
        aiPlayers: 1,
        aiPersonality: "defensive",
      },
      objectives: [
        objective(
          "keep",
          "Destroy Rival 1's keep",
          "Destroying the rival Command Keep completes the siege.",
          { type: "teamDefeated", team: 1 },
        ),
        objective(
          "workshop",
          "Optional: complete a workshop",
          "A workshop produces siege engines that excel against buildings.",
          building("workshop"),
          true,
        ),
        objective(
          "siege",
          "Optional: field two siege engines",
          "Keep spearmen and infantry near them. Siege engines are vulnerable to cavalry.",
          units(2, "siege"),
          true,
        ),
        objective(
          "armor",
          "Optional: research armor",
          "Build a blacksmith, then research armor to protect the siege escort.",
          { type: "research", team: 0, technology: "armor", level: 1 },
          true,
        ),
      ],
      triggers: [
        {
          id: "engines",
          when: { type: "time", seconds: 35 },
          actions: [
            { type: "resources", team: 0, gold: 160, wood: 140 },
            {
              type: "dialogue",
              text: "Engineer: Build a blacksmith after your barracks to unlock a workshop. Train siege there, then move with an infantry escort. Field Repair can keep the attack alive. Breach Charge strikes a visible enemy building within 6 tiles; approach with an escort, then withdraw while it recharges.",
            },
          ],
        },
      ],
      next: ["frontier"],
      reward: "Ironwatch title and the final chapter",
      unlocks: ["banner-ironwatch"],
      lessons: [
        "Prerequisites",
        "Siege escorts",
        "Research",
        "Engineer repair",
      ],
    }),
    defineMission({
      id: "frontier",
      title: "The Frontier",
      subtitle: "05 · Your banner",
      story:
        "No old kingdom remains to shelter behind. Two rival banners march on the settlements you built. Vale hands you the map and leaves the choice of road to you. This frontier will belong to the people who can hold it.",
      briefing:
        "Destroy both rival Command Keeps. Expand for supplies, choose your counters, and use relics to fund the siege. Keep your own keep standing.",
      settings: {
        seed: "FRONTIER-05",
        biome: "grasslands",
        mapSize: "large",
        difficulty: "hard",
        aiPlayers: 2,
        duration: 20,
        mode: "conquest",
        faction: "ironhold",
        commander: "warlord",
        startingGold: 420,
        startingWood: 420,
      },
      objectives: [
        objective(
          "rival-one",
          "Destroy Rival 1's keep",
          "Choose the first siege carefully. The other rival remains active.",
          { type: "teamDefeated", team: 1 },
        ),
        objective(
          "rival-two",
          "Destroy Rival 2's keep",
          "Both rival keeps must fall to complete the campaign.",
          { type: "teamDefeated", team: 2 },
        ),
        objective(
          "veterans",
          "Optional: research veterancy",
          "Your keep offers commander training. Inspect its research to strengthen your leadership.",
          { type: "research", team: 0, technology: "veterancy", level: 1 },
          true,
        ),
      ],
      triggers: [
        dialogue(
          "last-banner",
          4,
          "Vale: Two keeps, two roads. Claim the supplies between them, then take the frontier one stronghold at a time.",
        ),
        dialogue(
          "relic-funds",
          240,
          "Vale: In a conquest, relics supply gold and wood. Hold the center if the siege runs short.",
        ),
      ],
      next: [],
      reward: "Frontier Legend title and optional Iron Oath challenge",
      unlocks: ["banner-legend", "challenge-iron-oath"],
      lessons: ["Multiple rivals", "Relic siege economy", "Commander training"],
    }),
  ],
};
/** The second story exercises the exact same data-only authoring contract. */
export const EMBER_CAMPAIGN: AuthoredCampaign = {
  id: "ember-road",
  title: "The Ember Road",
  description:
    "Three Engineer chapters about rebuilding, escorting a support force, and breaking a blockade. Best played after The Outpost.",
  faction: "arcanists",
  commander: "engineer",
  entry: "rekindle",
  missions: [
    defineMission({
      id: "rekindle",
      title: "Rekindle the Hearth",
      subtitle: "01 · A road home",
      story:
        "Winter has swallowed the old trade road. The Arcanist settlers ask for a depot, two houses, and enough timber to rebuild what the raiders burned. Their hearth can become a beacon again.",
      briefing:
        "Complete a depot and two houses, and collect 900 wood. Protect your keep while rebuilding.",
      settings: {
        seed: "EMBER-REKINDLE",
        biome: "snow",
        mapSize: "small",
        difficulty: "easy",
        duration: 10,
        mode: "domination",
        aiPlayers: 1,
        faction: "arcanists",
        commander: "engineer",
        startingWood: 480,
        startingGold: 350,
      },
      objectives: [
        objective(
          "depot",
          "Complete a resource depot",
          "Build near your deposits to improve their income.",
          building("depot"),
        ),
        objective(
          "houses",
          "Keep two completed houses",
          "The settlers need room to return.",
          building("house", 2),
        ),
        objective(
          "wood",
          "Collect 900 wood",
          "Timber earned during this battle counts even after you spend it.",
          stat("woodCollected", 900),
        ),
      ],
      triggers: [
        dialogue(
          "hearth",
          4,
          "Settler: Claim the timber, then put a depot nearby. Two houses will give our people room to return.",
        ),
      ],
      next: ["lanterns"],
      reward: "The Lantern Bearers chapter",
      unlocks: [],
      lessons: ["Depot placement", "Economy growth", "Compact settlements"],
    }),
    defineMission({
      id: "lanterns",
      title: "The Lantern Bearers",
      subtitle: "02 · Light in the trees",
      story:
        "The healers carry lanterns from the rebuilt hearth. A raider band waits in the forest. Keep the healers safe, push them toward the relic, and let their light turn a narrow trail into a road home.",
      briefing:
        "Field two support units and eight total troops, and control a relic. Build an archery range to train support units.",
      settings: {
        seed: "EMBER-LANTERNS",
        biome: "forest",
        mapSize: "small",
        difficulty: "normal",
        aiPersonality: "raider",
        duration: 12,
        mode: "relic",
        aiPlayers: 1,
        faction: "arcanists",
        commander: "engineer",
        startingGold: 450,
        startingWood: 450,
      },
      objectives: [
        objective(
          "healers",
          "Keep two support units alive",
          "Train support units at the archery range and escort them with fighting troops.",
          units(2, "support"),
        ),
        objective(
          "escort",
          "Field eight living troops",
          "Your support units count toward the eight.",
          units(8),
        ),
        objective(
          "light",
          "Control a relic",
          "The escort and support force must survive while your banner holds the relic.",
          owned("relic"),
        ),
      ],
      triggers: [
        dialogue(
          "lantern-warning",
          30,
          "Healer: We can mend your soldiers, but cannot hold this road alone. Put infantry in front and keep the whole escort together.",
        ),
      ],
      next: ["blockade"],
      reward: "The Last Blockade chapter",
      unlocks: [],
      lessons: ["Support healing", "Army composition", "Escort positioning"],
    }),
    defineMission({
      id: "blockade",
      title: "The Last Blockade",
      subtitle: "03 · Open the road",
      story:
        "The final keep stands where the river road meets the plains. If it falls, every village between the hearth and the frontier can trade again. The Engineer's work is almost done.",
      briefing:
        "Destroy the rival Command Keep. Your optional challenge is to collect 1,500 gold before the blockade falls.",
      settings: {
        seed: "EMBER-BLOCKADE",
        biome: "desert",
        mapSize: "medium",
        difficulty: "normal",
        aiPersonality: "defensive",
        duration: 15,
        mode: "conquest",
        aiPlayers: 1,
        faction: "arcanists",
        commander: "engineer",
        startingGold: 400,
        startingWood: 400,
      },
      objectives: [
        objective(
          "blockade",
          "Destroy the rival keep",
          "Siege engines break structures; an escort keeps them alive.",
          { type: "teamDefeated", team: 1 },
        ),
        objective(
          "trade",
          "Optional: collect 1,500 gold",
          "Build a strong trade economy while preparing the final push.",
          stat("goldCollected", 1500),
          true,
        ),
      ],
      triggers: [
        dialogue(
          "road-opens",
          4,
          "Settler: One keep remains. Open the road, and the hearth will never go dark again.",
        ),
      ],
      next: [],
      reward: "Warden of the Ember Road title",
      unlocks: ["banner-warden"],
      lessons: ["Economy into siege", "Arcanist strengths"],
    }),
  ],
};
export const STORY_CAMPAIGNS: AuthoredCampaign[] = [
  FRONTIER_CAMPAIGN,
  EMBER_CAMPAIGN,
];
export function validateAuthoredCampaign(campaign: AuthoredCampaign): string[] {
  const errors: string[] = [],
    ids = new Set<string>(),
    unlocks = new Set<string>(PERSISTENT_CHOICES.map((choice) => choice.id));
  if (!campaign.id || !campaign.title || !campaign.missions.length)
    errors.push("A campaign needs an ID, title, and missions.");
  for (const chapter of campaign.missions) {
    if (ids.has(chapter.id)) errors.push(`Duplicate mission: ${chapter.id}`);
    ids.add(chapter.id);
    if (
      !chapter.title ||
      !chapter.story ||
      !chapter.briefing ||
      !chapter.objectives.some((item) => !item.optional)
    )
      errors.push(`${chapter.id}: missing story or required objectives.`);
    if (
      new Set(chapter.objectives.map((item) => item.id)).size !==
      chapter.objectives.length
    )
      errors.push(`${chapter.id}: duplicate objective ID.`);
    if (!chapter.settings.scriptedVictory)
      errors.push(
        `${chapter.id}: authored objectives require scripted victory.`,
      );
    const dimension = MAP_DIMENSIONS[chapter.settings.mapSize ?? "medium"];
    const bounds = {
      teamCount: (chapter.settings.aiPlayers ?? 1) + 1,
      width: dimension,
      height: dimension,
    };
    errors.push(
      ...validateTriggers(chapter.triggers, bounds).map(
        (message) => `${chapter.id}: ${message}`,
      ),
    );
    const goal = chapter.triggers.find(
      (trigger) => trigger.id === "mission-complete",
    );
    const required: ScriptCondition = {
      type: "all",
      conditions: chapter.objectives
        .filter((item) => !item.optional)
        .map((item) => item.condition),
    };
    if (!goal || JSON.stringify(goal.when) !== JSON.stringify(required))
      errors.push(
        `${chapter.id}: objective checklist and victory trigger disagree.`,
      );
    errors.push(
      ...validateTriggers(
        chapter.objectives.map((item) => ({
          id: `objective-${item.id}`,
          when: item.condition,
          actions: [{ type: "objective", text: item.title }],
        })),
        bounds,
      ).map((message) => `${chapter.id}: ${message}`),
    );
    for (const id of chapter.unlocks)
      if (!unlocks.has(id)) errors.push(`${chapter.id}: unknown unlock ${id}.`);
  }
  if (!ids.has(campaign.entry))
    errors.push("Campaign entry must name an existing mission.");
  const reachable = new Set<string>(),
    visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) {
      errors.push(`${id}: mission connections contain a cycle.`);
      return;
    }
    if (reachable.has(id)) return;
    const chapter = campaign.missions.find((item) => item.id === id);
    if (!chapter) {
      errors.push(`Unknown connected mission: ${id}`);
      return;
    }
    reachable.add(id);
    visiting.add(id);
    chapter.next.forEach(visit);
    visiting.delete(id);
  };
  visit(campaign.entry);
  for (const id of ids)
    if (!reachable.has(id))
      errors.push(`${id}: mission is unreachable from the campaign entry.`);
  return errors;
}
