# Creating campaigns and expeditions

Campaign content is declarative TypeScript data in `src/ui/campaigns/authored.ts`. `AuthoredCampaign`, `AuthoredMission`, and `MissionObjective` are the schema. The shipped registry contains the five-chapter **Rise of the Frontier** and the three-chapter **The Ember Road**. Neither story requires campaign-specific combat code.

## Add a story

1. Define a campaign with a stable `id`, `title`, `description`, `faction`, `commander`, `entry` mission ID, and `missions`.
2. Create each chapter with `defineMission`. Give it stable `id`, `title`, `subtitle`, `story`, `briefing`, `settings`, `objectives`, `next`, `reward`, `unlocks`, and `lessons`. `triggers` is optional.
3. Register the campaign in `STORY_CAMPAIGNS`. Keep old IDs and seeds stable after release; saves identify the campaign and chapter by ID.
4. Add any persistent reward definition to `PERSISTENT_CHOICES` in `src/ui/progression/profile.ts`. Titles are cosmetic; expedition charters are optional tradeoffs; challenges are optional rulesets. A description alone does not implement a new charter or challenge: add its actual launch behavior and tests too.
5. Run the content validator, typecheck, relevant tests, and a normal browser playthrough.

`next` contains the allowed successors. The entry chapter starts available; completing a chapter unlocks its direct successors. Completed chapters remain replayable. Saved explicit mission IDs take priority over old linear progress counters, so a branch cannot accidentally complete unplayed chapters. The shipped stories are linear, while the registry/runtime also support acyclic branching connections. A UI with multiple successors should present each of the values from `nextMissions`, rather than choosing the next array index.

## Objectives are the victory condition

An objective has `id`, visible `title`, visible `description`, and a typed `condition`. Set `optional: true` for a bonus task. `defineMission` sets `scriptedVictory: true` and compiles all required predicates into a `mission-complete` trigger. Ordinary relic score, enemy elimination, and storm adjudication cannot silently skip those predicates. Losing the player's own Command Keep still ends a scripted mission in defeat.

The checklist uses the simulation's `evaluateScriptCondition`, so visible completion and actual success use the same logic. Unless the condition measures a cumulative statistic, it describes the **current** state: “keep three spearmen alive,” “control two relics,” or “keep two completed towers standing.” Capturing and then losing a relic is not completion of a current-control objective. Describe this honestly in the briefing. A `stat` threshold counts resources collected even if the player later spends them.

```ts
import { defineMission, type AuthoredCampaign } from "./authored";

const riverStory: AuthoredCampaign = {
  id: "river-road",
  title: "The River Road",
  description: "Rebuild the crossing and secure the beacon.",
  faction: "ironhold",
  commander: "warlord",
  entry: "crossing",
  missions: [
    defineMission({
      id: "crossing",
      title: "The Crossing",
      subtitle: "01 · A bridge home",
      story: "The settlers wait for a safe road across the frontier.",
      briefing: "Complete a house and control a relic. Protect your keep.",
      settings: {
        seed: "RIVER-CROSSING-01",
        biome: "grasslands",
        mapSize: "small",
        mode: "domination",
        difficulty: "easy",
        duration: 10,
        faction: "ironhold",
        commander: "warlord",
        aiPlayers: 1,
      },
      objectives: [
        {
          id: "shelter",
          title: "Complete a house",
          description: "A house creates room for your army.",
          condition: {
            type: "buildings",
            team: 0,
            building: "house",
            count: 1,
          },
        },
        {
          id: "beacon",
          title: "Control a relic",
          description: "Hold the relic while your house stands.",
          condition: { type: "owned", team: 0, kind: "relic", count: 1 },
        },
      ],
      triggers: [
        {
          id: "welcome",
          when: { type: "time", seconds: 4 },
          actions: [
            { type: "dialogue", text: "Scout: The river road is open." },
          ],
        },
      ],
      next: [],
      reward: "The river road is safe",
      unlocks: [],
      lessons: ["Population", "Relic control"],
    }),
  ],
};
```

## Conditions and actions

Conditions in `ScriptCondition`:

| Type             | Required data                        | Meaning                                     |
| ---------------- | ------------------------------------ | ------------------------------------------- |
| `time`           | `seconds`                            | Elapsed simulation time                     |
| `captured`       | `nodeId`, `team`                     | This exact node is currently owned          |
| `owned`          | `team`, `kind`, `count`              | Current gold, wood, or relic node count     |
| `resource`       | `team`, `resource`, `amount`         | Current gold/wood balance                   |
| `stat`           | `team`, `stat`, `amount`             | Cumulative `PlayerStats` threshold          |
| `units`          | `team`, `count`, optional `unit`     | Living completed troop count                |
| `buildings`      | `team`, `count`, optional `building` | Living completed building count             |
| `research`       | `team`, `technology`, `level`        | Completed research level                    |
| `teamDefeated`   | `team`                               | That player has been eliminated             |
| `destroyed`      | `entityId`                           | That specific entity is no longer alive     |
| `region`         | `team`, `x`, `y`, `radius`           | A living friendly entity enters a region    |
| `entityLocation` | `entityId`, `x`, `y`, `radius`       | A specific living entity reaches a location |
| `all` / `any`    | `conditions`                         | Nested Boolean combinations                 |

Actions in `ScriptAction`: `dialogue`, `resources`, `spawn`, `victory`, `defeat`, `reveal`, `objective`, and `alliance`. An alliance action supplies a player `team` and the new `alliance` number. This changes targeting and shared vision; changing only narrative text does not create a truce. Broken Alliance demonstrates a timed truce and betrayal.

The `objective` action changes the engine's visible objective text. It does not rewrite the chapter checklist or success predicate. If a mission changes phases, represent the full final requirement in structured conditions and describe the phases up front. Do not advertise unimplemented objective tracking.

Trigger `fired` flags are serialized. Install a chapter's fresh triggers with `installMission` only when a new battle starts. On Continue, keep the restored trigger state; reinstalling would replay dialogue and duplicate resource gifts. Retry creates a fresh game from the same chapter settings.

## Settings, maps, and modifiers

Settings are partial `GameSettings`: seed, map generator version, biome, map size, player count/slots, difficulty, personality, mode, duration, starting resources, population, terrain and economy settings, and optional validated `customMap`. A workshop-authored map can carry stable entity IDs, authored camps/forces, scenario rules, and map triggers. Inspect `scenario-types.ts` and `scenarios.ts` for that schema.

Create authored and expedition games from their declared settings. Do not merge a previous skirmish's `customMap`, `slots`, `learning`, or modifiers into them: that can change team counts or apply unrelated bonuses to a scripted mission.

Use `settings.modifiers.players[0]` for player-specific `income`, `captureSpeed`, `damage`, and `health` multipliers or additive `startingGold`/`startingWood`. The legacy `income` and `captureSpeed` fields are global. `startingGold` and `startingWood` in ordinary settings apply to **every** player. Never claim a player reward while giving all rivals the same increase.

Spawn encounters only on reachable terrain and within the map bounds. Prefer authored stable entity IDs when a condition names one exact unit or building. Generated incidental entity IDs are fragile; kind/count/region predicates are usually a better fit for seeded maps.

## Branching expedition

`src/ui/campaigns/expedition.ts` defines the route graph and pure run reducer. The shipped expedition has seven stops and four battles. Its node kinds are `battle`, `elite`, `village`, `shop`, `relic`, `event`, and `boss`. A node's `next` values name the stops available after it. Choices have an ID, title, explicit effect description, optional crown cost, and reward data.

- Crowns are an expedition-only currency, earned on the route and spent at shops/events.
- Gold/wood bonuses apply at the start of every later battle in the current run.
- Damage/health bonuses change the player's real simulation entities only.
- Event costs and charter disadvantages are explicit. Charter choices unlock persistently, but their power/tradeoffs apply only to that run.
- Completing a battle records the result once. Losing ends the run; a new run resets its supplies and upgrades.

Use `startUnlockedExpedition` for the UI entry point; it checks charter unlocks. The low-level `createExpedition` constructs a run for trusted code/tests. `visitExpeditionNode`, `chooseExpeditionReward`, `finishExpeditionBattle`, and `expeditionBattle` implement transitions and launch settings. Save with `saveExpedition`. `restoreExpedition` replays a bounded journal against the known graph: currency and multipliers are reconstructed instead of trusted from stored JSON. Invalid links, unaffordable purchases, duplicated results, or unknown choices are rejected.

Persist a choice or battle result before leaving that screen. Persist the active run together with a battle save so Continue resumes the same encounter. When a between-battle run says it is at a battle but no matching save exists, the UI can launch that encounter from its deterministic settings. Never award the previous node again.

## Profile and achievements

`src/ui/progression/profile.ts` owns the version-2 profile, safe legacy migration, category/progress/hidden/timestamp records, usage counters, resource and army totals, fastest victory, cosmetic/choice unlocks, and the latest 50 match summaries. Call `recordBattleResult` with a stable, saved `matchId`. The reducer deduplicates recently recorded matches, so opening or restoring a result cannot award it twice.

Results use shared alliance/scenario outcome helpers. A teammate's victory is a victory for the local alliance. A defeated player's surviving allies can still win; such a spectator is not prematurely recorded as a loss. A fully defeated local alliance can be recorded before unrelated rivals finish. Scripted missions end in personal defeat when the local keep falls, even with surviving allies. The history uses the same local reason as the result screen.

Legacy aggregate wins, kills, play time, chapter progress, and unlocks survive migration. Details that the old profile never collected are not invented. An old achievement's unknown unlock date is shown as “Earned before detailed records began.” Starting troops/buildings are included in the engine's creation counters and are described as such in the UI.

## Validation and evidence

`validateAuthoredCampaign` checks mission IDs, connections, reachability, cycles, objective/victory agreement, typed triggers including optional objectives, and persistent unlock IDs. `validateExpedition` checks route connections, node classes, choices, prices, and a free exit from each choice stop. Validation never executes arbitrary campaign JavaScript from an import. Register both validators with the application's content-validation script.

`tests/campaign-progression.test.ts` checks each chapter's required objectives, loss/retry, deterministic maps, saved/restored victory, graph unlocks, all 1,080 affordable expedition routes, real player-only rewards, every save boundary, invalid journals, profile migration, timestamps, alliance outcomes, and duplicate-result protection. The objective-completion tests use controlled state fixtures; they establish correctness, not ordinary-play difficulty or narrative pacing. Browser playthroughs still need to check all advertised chapters, choices, save/Continue, retry, phone readability, and unlocked title/charter/challenge actions.

## Integrated persistence and navigation

The application now imports this registry through `src/ui/content.ts`; the build validator includes both stories and the expedition graph. The result UI chooses explicit successors from `nextMissions`, so it does not assume the next chapter's array index.

New battle envelopes use version 2 with a stable match ID plus a campaign session or expedition journal. The separate `expedition` record stores the validated route and its matching encounter checkpoint; playing a skirmish does not erase that checkpoint. Route choices commit before advancing the screen, and failed writes leave the previous choice available. Repeated asynchronous journey actions are guarded; newer navigation cancels delayed UI takeover. `Save route` is available between encounters.

`src/ui/campaigns/session.ts` checks chapter ID, expected seed, stable match identity, authored victory trigger presence, and encounter/route correspondence. Fired engine triggers are restored unchanged. Stale encounter checkpoints cannot replay a completed stop. A corrupt or missing battle checkpoint preserves a valid route and restarts only its current encounter.

`loadProfile()` reads raw local data before v2 migration so nested statistics and nullable fastest-victory fields survive. Version-1 battle envelopes continue their original saved simulation as standalone legacy battles; they do not acquire the new checklist or new expedition rewards. Existing profile chapter victories and unlocks migrate separately. A fresh chapter launch uses the new authored objectives.

Workshop test sessions return before profile, Continue, or expedition persistence. Ordinary allied/special-mission result semantics come from shared simulation helpers rather than UI winner-index assumptions.
