import { validateContent } from "../src/sim/content";
import { CAMPAIGNS, validateCampaign } from "../src/ui/content";
import { validateExpedition } from "../src/ui/campaigns/expedition";
const errors = [
  ...validateContent(),
  ...CAMPAIGNS.flatMap(validateCampaign),
  ...validateExpedition(),
];
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `Content validated: ${CAMPAIGNS.reduce((sum, c) => sum + c.missions.length, 0)} story missions.`,
);
