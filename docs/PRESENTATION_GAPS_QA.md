# Faction identity, research and About checkpoint

Date: 2026-10-04. Scope: original request sections 12, 25, 36 and 37.

## Implemented

- `src/render/factionIdentity.ts`: original code-native tower / antler / crystal crests, steel / carved timber / crystal material accents, building-front hangings and unit / commander side standards. The source sprite atlas remains unchanged. These are a shared-atlas faction treatment, not three newly authored sprite sets.
- `src/render/art.ts` and `Battlefield.ts`: six team colors and separate cross / diamond / circle / square / triangle / saltire markers; faction treatments do not replace team markers. Cached crest paths avoid constructing new vector paths for every entity every frame. Decoration remains simulation-independent and introduces no animated effects.
- `src/ui/research.ts`: all six technologies grouped by their actual research building. The construction path is shown (Barracks → Blacksmith; Archery Range; Command Keep), along with sequential level steps, existing effect text, scaled prices, duration estimates, queued / complete / missing-building / insufficient-funds / full-queue states. Technology branches do not invent cross-technology prerequisites. A preplaced completed Blacksmith works even without a Barracks. Explicit selected-building routing matches the command handler.
- Research uses the tactically projected state, reserves planned jobs correctly and remains locked during the guided learning sequence until its final lesson is complete.
- `src/ui/about.ts`: Credits / About from both home and battle menu, exact package version, all six soundtrack titles, source provenance, controls and faction key. Reference-art licensing is explicitly unverified; generation is not described as CC0 or commercial clearance. The screen states that this preview includes no project-wide license grant and retains the recovery / reconstruction distinction for audio.
- Existing interface text-size settings now affect menu, setup, dialog and research text. Map / command-deck disclosure targets and recruitment batch targets are at least 44 CSS pixels. Population receives a live value-bearing accessible label. Minimap disclosure has `aria-expanded` and `aria-controls`.

## Executed checks

The logs are saved in `artifacts/presentation-evidence/`.

- `npm run check`: passed.
- `npm run build`: passed, including content validation and scoped offline shell generation.
- Focused Vitest run: **75 / 75 passed in 9 files**. Includes three faction-render contract checks and nine research / About checks, plus existing renderer / setup / inspection regressions.
- `git diff --check`: passed after trimming an extra trailing blank line.
- Browser test discovery: **21 cases in one new spec** across desktop, phone portrait and phone landscape. Discovery is not execution.

## Unverified acceptance gates

No Chromium launch was retried in this workstream after the parent confirmed a local socket-policy block. No new screenshot or actual browser/pixel review is claimed. `tests/browser/presentation.spec.ts` supplies executable cases and named screenshots for:

- Credits provenance, controls, keyboard dismissal and 130% text scaling;
- research paths, blocked states and tactical queued state;
- 44-pixel disclosure targets, population label and map expanded state;
- setup faction legend;
- equal-team visual fixtures for Ironhold, Wildborn and Arcanists.

Run that spec against this exact integrated candidate using a permitted browser route, inspect the emitted pixels at all three viewports, and adjust any layout or combat readability issues before claiming visual sign-off. Existing browser results from an earlier candidate do not validate these additions. A full repaint / distinct faction sprite set remains a separate art expansion.
