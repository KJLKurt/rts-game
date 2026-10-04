import { validateContent } from '../src/sim/content';
import { CAMPAIGN, validateCampaign } from '../src/ui/content';
const errors=[...validateContent(),...validateCampaign(CAMPAIGN)];
if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log(`Content validated: ${CAMPAIGN.missions.length} story missions.`);
