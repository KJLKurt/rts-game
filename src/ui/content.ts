/** Stable public facade: menus and validation use the same authored definitions. */
export {
  FRONTIER_CAMPAIGN as CAMPAIGN,
  STORY_CAMPAIGNS as CAMPAIGNS,
  validateAuthoredCampaign as validateCampaign,
} from "./campaigns/authored";
export type {
  AuthoredMission as Mission,
  AuthoredCampaign as CampaignDefinition,
} from "./campaigns/authored";
export { ACHIEVEMENT_DEFINITIONS as ACHIEVEMENTS } from "./progression/profile";
