import type {
  AIPersonality,
  BuildingId,
  CommanderId,
  Difficulty,
  FactionId,
  GameMap,
  Point,
  UnitId,
} from "./types";

/** Slot indices remain stable; alliance is an independent team grouping. */
export interface MapPlayerSlot {
  name: string;
  controller: "human" | "ai" | "closed";
  alliance: number;
  faction: FactionId;
  commander: CommanderId;
  personality: AIPersonality;
  difficulty: Difficulty;
}
export interface MapRules {
  mode: "domination" | "conquest" | "relic";
  duration: number;
  populationCap: number;
  startingGold: number;
  startingWood: number;
  startingForces: "standard" | "authored";
  scoreTarget?: number;
  gameSpeed?: number;
  incomeRate?: number;
}
type Placement = Point & { id: string; team: number };
export type MapEntityPlacement = Placement &
  (
    | { kind: "unit"; type: UnitId }
    | { kind: "commander"; type: CommanderId }
    | { kind: "building"; type: BuildingId; buildingLevel?: 1 | 2 | 3 }
  );
/** Neutral defenders never consume a player slot or count toward elimination victory. */
export interface MapNeutralCamp extends Point {
  id: string;
  unit: UnitId;
  count: number;
  radius: number;
  rewardGold: number;
  rewardWood: number;
}
export interface MapScenario {
  version: 1;
  slots: MapPlayerSlot[];
  rules: MapRules;
  startingEntities: MapEntityPlacement[];
  camps: MapNeutralCamp[];
}
export type WorkshopMap = GameMap & { name?: string; scenario?: MapScenario };
