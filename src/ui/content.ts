import type { GameSettings, ScriptTrigger } from "../sim/types";
export interface Mission {
  id: string;
  title: string;
  subtitle: string;
  story: string;
  briefing: string;
  settings: Partial<GameSettings>;
  triggers: ScriptTrigger[];
  reward: string;
}
export interface CampaignDefinition {
  id: string;
  title: string;
  description: string;
  missions: Mission[];
}
export const CAMPAIGN = {
  id: "rise-of-the-frontier",
  title: "Rise of the Frontier",
  description: "Five battles. One frontier worth fighting for.",
  missions: [
    {
      id: "outpost",
      title: "The Outpost",
      subtitle: "01 · A foothold",
      story:
        "The old road ends here. Beyond it, the frontier belongs to whoever can hold it. Captain Vale has given you a banner, a handful of soldiers, and one order: build something that lasts.",
      briefing:
        "Capture the nearby gold and timber. Recruit a small army, then claim the central relic.",
      settings: {
        seed: "OUTPOST-01",
        biome: "grasslands",
        mapSize: "tiny",
        difficulty: "easy",
        duration: 8,
        mode: "domination",
        startingGold: 340,
        startingWood: 300,
      },
      triggers: [
        {
          id: "welcome",
          when: { type: "time", seconds: 4 },
          actions: [
            {
              type: "dialogue",
              text: "Vale: A frontier is more than walls. Claim those supplies and give our people a foothold.",
            },
          ],
        },
        {
          id: "reinforcements",
          when: { type: "time", seconds: 65 },
          actions: [
            { type: "resources", team: 0, gold: 120, wood: 100 },
            {
              type: "dialogue",
              text: "Vale: The supply wagon made it. Put these resources to work.",
            },
          ],
        },
      ],
      reward: "A new chapter",
    },
    {
      id: "hold-line",
      title: "Hold the Line",
      subtitle: "02 · The long night",
      story:
        "Smoke rises beyond the pines. A raiding host has found your outpost. The settlers cannot leave before dawn. Make every tower, spear, and second count.",
      briefing:
        "Build towers and spearmen. Protect your keep while expanding to the relic.",
      settings: {
        seed: "HOLD-LINE-02",
        biome: "forest",
        mapSize: "small",
        difficulty: "normal",
        aiPersonality: "aggressive",
        duration: 12,
        mode: "domination",
        startingWood: 360,
      },
      triggers: [
        {
          id: "warning",
          when: { type: "time", seconds: 75 },
          actions: [
            {
              type: "dialogue",
              text: "Scout: Raiders on the western road. Keep your spearmen near the archers.",
            },
          ],
        },
      ],
      reward: "A new chapter",
    },
    {
      id: "broken-alliance",
      title: "Broken Alliance",
      subtitle: "03 · Ash and oaths",
      story:
        "The Wildborn have crossed the border. But their warbands are not the only force moving through the dunes. Seize the ancient beacon before either rival can claim it.",
      briefing:
        "Two rivals contest the frontier. A mobile force can take supplies while they fight.",
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
      },
      triggers: [],
      reward: "A new chapter",
    },
    {
      id: "ironwatch",
      title: "Siege of Ironwatch",
      subtitle: "04 · Break the gate",
      story:
        "Ironwatch survived a hundred winters. Its commander believes stone can outlast resolve. The workshop is ready. Prove him wrong.",
      briefing:
        "Construct a workshop. Escort siege engines with infantry and support troops to destroy the enemy keep.",
      settings: {
        seed: "IRONWATCH-04",
        biome: "snow",
        mapSize: "medium",
        difficulty: "hard",
        commander: "engineer",
        startingGold: 500,
        startingWood: 450,
        mode: "conquest",
        duration: 18,
      },
      triggers: [
        {
          id: "engines",
          when: { type: "time", seconds: 35 },
          actions: [
            { type: "resources", team: 0, gold: 160, wood: 140 },
            {
              type: "dialogue",
              text: "Engineer: Our engines can crack that keep. But leave them unguarded and the cavalry will make short work of them.",
            },
          ],
        },
      ],
      reward: "The final chapter",
    },
    {
      id: "frontier",
      title: "The Frontier",
      subtitle: "05 · Your banner",
      story:
        "There are no reinforcements coming. No older kingdom left to shelter behind. The people of the frontier are watching your banner. Give them a reason to believe.",
      briefing:
        "Use every lesson. Expand, counter the enemy army, and control the relic before the final storm.",
      settings: {
        seed: "FRONTIER-05",
        biome: "grasslands",
        mapSize: "large",
        difficulty: "hard",
        aiPlayers: 2,
        duration: 20,
        mode: "domination",
      },
      triggers: [],
      reward: "Frontier legend",
    },
  ] satisfies Mission[],
};
/** Register additional campaigns here; the menu and separate progression are data-driven. */
export const CAMPAIGNS: CampaignDefinition[] = [CAMPAIGN];

export const ACHIEVEMENTS = [
  ["first-victory", "First Light", "Win your first battle."],
  ["veteran", "Veteran", "Play five battles."],
  ["conqueror", "Conqueror", "Win five battles."],
  ["legend", "Frontier Legend", "Complete the story campaign."],
  ["streak", "Unbroken", "Win three battles in a row."],
  ["century", "A Hundred Banners", "Defeat 100 units across battles."],
  ["thousand", "An Army Falls", "Defeat 1,000 units across battles."],
  ["hour", "Watchful Commander", "Spend one hour on the battlefield."],
  ["capture", "Stake Your Claim", "Capture a resource point."],
  ["builder", "Foundations", "Construct five buildings in one battle."],
  ["recruiter", "Raise the Banner", "Recruit twenty units in one battle."],
  ["economist", "Golden Age", "Collect 2,000 gold in one battle."],
  ["woodsman", "Deep Roots", "Collect 2,000 wood in one battle."],
  ["tactician", "Time to Think", "Use tactical pause."],
  ["siege", "Stonebreaker", "Win a conquest battle."],
  ["warlord", "Iron Will", "Win as the Warlord."],
  ["ranger", "True Shot", "Win as the Ranger."],
  ["engineer", "Built to Last", "Win as the Engineer."],
  ["hard", "Against the Odds", "Win on hard difficulty."],
  ["expedition", "Wayfinder", "Complete an expedition."],
  ["quick", "Lightning Victory", "Win in under eight minutes."],
  ["survivor", "Unscathed", "Win without losing your commander."],
].map(([id, name, description]) => ({ id, name, description }));

/** Build-time content validation. Campaigns are declarative data, never evaluated scripts. */
export function validateCampaign(campaign: CampaignDefinition): string[] {
  const errors: string[] = [],
    ids = new Set<string>();
  if (
    !campaign.id ||
    !campaign.title ||
    !Array.isArray(campaign.missions) ||
    !campaign.missions.length
  )
    errors.push("Campaign needs an id, title, and at least one mission.");
  for (const mission of campaign.missions) {
    if (!mission.id || ids.has(mission.id))
      errors.push(`Duplicate or missing mission id: ${mission.id}`);
    ids.add(mission.id);
    if (!mission.title || !mission.briefing)
      errors.push(`${mission.id}: title and briefing are required.`);
    const triggerIds = new Set<string>();
    for (const trigger of mission.triggers) {
      if (triggerIds.has(trigger.id))
        errors.push(`${mission.id}: duplicate trigger ${trigger.id}`);
      triggerIds.add(trigger.id);
      if (
        !["time", "captured", "resource", "destroyed", "region"].includes(
          trigger.when.type,
        )
      )
        errors.push(`${mission.id}: unknown trigger type`);
      if (
        trigger.when.type === "time" &&
        (!Number.isFinite(trigger.when.seconds) || trigger.when.seconds < 0)
      )
        errors.push(`${mission.id}: invalid trigger time`);
      if (!trigger.actions.length) errors.push(`${mission.id}: empty trigger`);
      for (const action of trigger.actions)
        if (
          ![
            "dialogue",
            "resources",
            "spawn",
            "victory",
            "reveal",
            "objective",
          ].includes(action.type)
        )
          errors.push(`${mission.id}: unknown action`);
    }
  }
  return errors;
}
