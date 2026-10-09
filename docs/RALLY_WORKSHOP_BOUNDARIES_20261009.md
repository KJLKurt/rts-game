# Truthful rally feedback and supported workshop duration

## Bounded scope

This candidate follows exact live `febfa91d644a6576e98a5dede8ffc452ae176829` / `fc-e201ecf2a981`. It closes the next two demonstrated usability inconsistencies from the preserved 56-section original/expanded requirements audit. It does not change combat balance, economy, map-generation rules, simulation source, artwork or music.

- **C3:** Mass rally includes only existing living, completed recruitment buildings. Feedback counts actual command acceptance, distinguishes queued from already-applied rally points, reports partial acceptance and full tactical queues, and preserves the fixed commander-position semantics. Nonproducers and unfinished/dead buildings no longer waste tactical slots.
- **C5:** Authored workshop maps receive their actual custom-map context in shared validation. The already-supported 4–180-minute range now survives validation and Test map launch. Generated legacy maps retain their existing limit; numeric, army-budget, structural, scenario and geometry checks remain enforced.

## Red-first local evidence

C3 first exercised the exact old `rally-all` action through a small unit harness: six failures and one passing recovering-commander control. The failures established wasted nonproducer slots, false immediate-success wording while paused, concealed partial acceptance at 59 orders, false success at 60 orders, dead/unfinished producer handling and no-producer handling.

After correction, all 26 focused mass-rally tests pass, including 0/58/59/60 budgets, repeated clicks, five producer types, engine error feedback, saved pending/applied rally points, Resume and real recruitment destinations. One expanded test initially inspected a nearby destination after the recruit had already arrived and become Idle. That separate fixture-timing failure is preserved; moving the controlled destination beyond the spawn exit corrected its setup without changing production code.

C5 first established that 90 minutes passed while 91, 120 and 180 failed with “Targets longer than 90 minutes require generator v5.” The expanded pre-fix workshop suite preserved 19 failures. The correction is one context field at `validateWorkshopMap`; all 70 workshop tests now pass, including 41 additions. Coverage includes versions 3/4/5, 4/90/91/120/180 boundaries, invalid inputs, JSON/library persistence, launch reconstruction, exact game-save restoration and isolated test-return state.

## Integrated local verification

All **1,163 unit tests across 88 files**, TypeScript checks, content validation and build pass. Independent source review found no blocking issue. The candidate production identity is `fc-f9ca19483611`, JavaScript `index-B6auTkhX.js`, unchanged CSS `index-txElQ2m-.css`, cache `c67ebca581d5`; all 83 production files are frozen for native acceptance. All 16 simulation files and 78 public source assets remain unchanged.

## Native acceptance status

Pending. The planned single coherent run first preserves two positive native oracles failing on exact previous-live production: full-cap rally feedback and 91-minute workshop validation. It then exercises the candidate's 0/59/60 rally boundaries, 90/91/120/180 editor round trips, invalid 3/181 inputs, and three affected existing regression identities across desktop, portrait and landscape. The final stage is a sequential exact-live cache update with paid production and one-time construction completion. Retries are disabled, and every actual result and qualification will remain recorded.

Rally tests use disclosed initial controlled fixtures for additional legal completed buildings, commander position, AI and pending-order boundaries; these are not earned buildings or natural-play claims. Measured rally, recruitment, saving, Continue and Resume use native player controls. Workshop tests use ordinary UI from fresh generated drafts, with no game-state/storage injection. They preserve each random seed and map. Invalid edges respect the browser's own min/max guard rather than bypassing validation.

These checks establish configuration, launch, controls and persistence. They do not establish actual 90–180-minute match lengths, uncoached understanding or a natural victory.

## Wider scope retained

The complete original and later expanded audit remains open wherever not actually accepted. Natural default/long pacing, uncoached mobile control feel, integrated dense-device performance, physical-device/Safari/offline behavior, subjective listening, late campaign and complete Expedition outcomes still require acceptance. Four static themes do not complete recorded directional/style/theme commitments. The fresh hosted record remains a genuine 7:33 Easy Conquest defeat; there is no continuity claim with the lost earlier profile.
