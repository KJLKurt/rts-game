# Creating a campaign

Story missions live in `src/ui/content.ts`; simulation trigger types live in `src/sim/types.ts`. To extend the current campaign, add a `Mission` object to `CAMPAIGN.missions`. The menu, locked progression, next-chapter flow, and saved mission index use that array. To add a separate campaign, create a `CampaignDefinition` and register it in `CAMPAIGNS`. The menu automatically shows a campaign selector when more than one is registered. Each campaign has separate persistent chapter progress; saves retain the campaign ID. No combat or menu code needs to change.

## Mission definition

Required fields are `id`, `title`, `subtitle`, `story`, `briefing`, `settings`, `triggers`, and `reward`. IDs must be unique. `settings` is a partial `GameSettings`: seed, biome, map size, commander, faction, AI difficulty/personality/player count, mode, requested duration, starting resources, modifiers, and optionally an authored `customMap`.

A mission can reuse a deterministic seed or supply a validated editor export. Keep seeds stable after release so old story saves retain their context. Use `settings.modifiers` for bounded income, player health/damage, and capture-speed adjustments. A mission’s briefing describes the actual gameplay goal; the current engine supports domination, relic score, conquest, and Rush survival.

## Declarative triggers

Each trigger has `id`, `when`, `actions`, and serialized `fired`. Conditions:
- `time`: seconds elapsed
- `captured`: node ID and team
- `resource`: team, gold/wood, amount threshold
- `destroyed`: entity ID
- `region`: team, center, radius

Actions:
- `dialogue`: text and optional team
- `resources`: team, gold, wood
- `spawn`: team, unit ID, count, world x/y
- `victory`: winning team
- `reveal`: team visibility
- `objective`: replacement objective text

Example:

```ts
{
 id: 'ambush-warning',
 when: { type: 'time', seconds: 90 },
 actions: [
  { type: 'dialogue', text: 'Scout: Riders beyond the old bridge.' },
  { type: 'spawn', team: 1, unit: 'cavalry', count: 3, x: 21.5, y: 14.5 }
 ]
}
```

Place spawn actions on reachable ground and verify encounters from both perspectives. Entity IDs are assigned deterministically, but node/region/time triggers are more resilient than hard-coded incidental unit IDs. The system deliberately does not execute arbitrary JavaScript supplied by a campaign.

## Validation and playtesting

`npm run build` runs `scripts/validate-content.ts`. `npm test` validates IDs and starts every story mission. Run the mission in-browser, play through the trigger, save/restore around it, and verify it fires once. Headless validity does not establish that dialogue pacing or combat difficulty feels good.

The current content uses linear progression with five missions and chapter unlocks. Arbitrary mission graph connections, shops, and authored alliance changes are documented extension work; do not imply a field is implemented merely by adding it to a content file.
