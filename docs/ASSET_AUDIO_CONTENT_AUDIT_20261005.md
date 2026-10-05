# Asset, audio and content audit — 5 October 2026

This audit checks the owner's original 56-section prompt, the nine attached reference images, retained generation/source records and the actual shipped files. It distinguishes implemented content, source provenance, measurable playback and natural gameplay. It is not a claim of commercial readiness or subjective musical quality.

## Authority and evidence

The owner's 3 October asset message identifies the images as supplied by his brother and authorizes their use, improvement or expansion for this game. The later repository instruction selects `KJLKurt/rts-game`; the copied brief's earlier repository is superseded. Project development and publication are already authorized. No new approval for that work is inferred from a missing project-wide open-source license.

The private QA evidence preserves the exact original prompt, sanitized attachment metadata, nine byte-exact JPEGs and SHA256 hashes. The two supplied shared-chat pages yielded no readable generation records here; their contents or license terms are not inferred. Original references are evidence inputs, not additional files added to the public game.

## Shipped visual assets and provenance

| Material | Classification and retained evidence | Precise limitation |
| --- | --- | --- |
| Nine original JPEG references | Brother-supplied material, attributed by the owner. Three visual styles appear: sticker, realistic and toy 3D. The set includes two actor sheets, three combined sheets, three resource sheets and one building sheet. Each was visually inspected. | Their original creation method and any third-party inputs were not independently established. Supplying them for this project establishes project-use authority, not a verified CC0/public-domain designation. |
| `frontier-atlas.png` and frame manifest | Project-specific image generation adapting the supplied seasonal toy-3D art, as recorded in [ART_DIRECTION.md](ART_DIRECTION.md). 1254×1254 RGBA, 36 static frames. SHA256 `7a6c1f79fece96ce65464831cb161b6a4fb60c098afaf3717b271812b20f87ed`. The supplied combined toy-3D sheet `9dd83781-0453-4565-a619-7e68facd2898.jpeg` (`F0C6LR8K4U9`) strongly matches the roles and poses visually. | That mapping is a visual inference: the original main-atlas tool receipt identifying its exact reference input was not retained in the repository. No original JPEG is shipped byte-for-byte. |
| `frontier-combat-animation.png` and metadata | Newly generated for this project using the approved atlas. Three dated image-generation pass prompts are retained in [ANIMATION_GENERATION_PROMPTS.json](ANIMATION_GENERATION_PROMPTS.json); acceptance and immutable source details are in [ATTACK_ANIMATION_TRIAL.md](ATTACK_ANIMATION_TRIAL.md). PNG SHA256 `664b416192cbd297655a63fd8ec048f1b79030b35b3c0af7a3fc9ecd4073758f`. | Only twelve accepted attack cells are active: four each for Warlord, Swordsman and Archer. Walking arrays are empty. These are not full directional, movement or defeat sprite sets. |
| Terrain, effects, UI vectors and faction crests | Original Canvas/SVG project code, including `src/render/factionIdentity.ts`. System fonts are used. The shield/castle PWA icon is project vector artwork with derived PNG icons. | Three faction identities share a base atlas with code overlays; they are not three separately animated art packs. No external font service or image asset pack was identified in the shipped files. |

The 36 atlas frames cover staged gold/wood/relics, camp/cue art, six units, three commanders and eleven building images. Only nine building definitions are implemented. Arcane and wall frames do not create playable building types. Camp/cue frames being present in the manifest is not evidence of an implemented gathering animation. Renderer movement interpolation, mirroring and bob are presentation effects, not authored eight-direction sprite frames.

The specific remaining reference-rights evidence is a creator/source-generation record and rights basis for the selected brother-supplied reference(s), especially the matching combined toy-3D sheet: who created it, whether any third-party source was used, and whether that creator has authority to permit derivative sprites and public/commercial redistribution with any applicable conditions. The owner has already authorized this project's use and publication. No separate third-party music/sample permission was found necessary from the retained synthesis source. This identifies an evidence gap without inventing a license grant or treating all nine unused reference variants as separate shipped assets.

## Audio inventory and technical verification

All six states have original, deterministic programmatic compositions using mathematical oscillators and noise. No recordings, samples, soundfonts, artist imitation, third-party music service or paid account is used in the retained generator. Browser event sounds are synthesized separately: the `SoundEffect` type has seventeen events, including victory and defeat events that select the result scores rather than separate effects files. Source concurrency limits are twelve effect voices and thirty-two fallback music voices, with event throttling.

Exploration and combat retain the four codec files recovered from checkpoint `242b6df`; reconstructed generator output matches their decoded PCM exactly. Menu, tension, victory and defeat were reconstructed from retained definitions. Their prior encoded-byte identity is unproven. This distinction remains in [AUDIO_REPLACEMENT.md](AUDIO_REPLACEMENT.md) and `scripts/audio/PROVENANCE.txt`; this audit does not relabel all twelve files as preserved originals.

| State / cue | Duration | Ogg integrated LUFS | Ogg true peak dBTP | Loop |
| --- | ---: | ---: | ---: | --- |
| Menu / Welcome to the Winter Workshop | 40 s | −20.23 | −9.06 | Yes |
| Exploration / Lanterns in the Pines | 80 s | −19.08 | −6.86 | Yes |
| Tension / Lanterns on Watch | 40 s | −20.05 | −6.06 | Yes |
| Combat / Clockwork Brigade | 80 s | −18.58 | −4.71 | Yes |
| Victory / A Banner in the Snow | 7.5 s | −15.89 | −3.23 | No |
| Defeat / Gather the Fallen Banners | 10 s | −19.28 | −8.00 | No |

FFmpeg decoded all twelve Ogg/MP3 files at 44.1 kHz stereo, with exact intended PCM duration, no clipped samples, absolute DC below 0.0001 and true peaks below −3 dBTP. Each looping cue's boundary step is smaller than its largest interior sample step. These measurements do not prove an imperceptible seam, pleasant mix, fatigue resistance or musical quality. Encoded files total 5,948,859 bytes. Historical `docs/AUDIO_VALIDATION.json` remains untouched; new measurements are separate QA evidence.

Actual sandboxed Chromium verified no AudioContext before a trusted gesture, a running context and decoded loop after a native Settings gesture, independent Master/Music/Effects values, zero master output under mute, music disabled while a native selection produces an effect signal, settled silence with both buses disabled, restored nonzero music, persisted preferences after reload, and browser decoding of all twelve exact files. Read-only analyser probes preserve the original output; a zero-gain observation branch contributes no audio. Raw attempts preserve harness selector/settling mistakes separately from the successful run, with zero uncaught runtime errors.

There is no `/dev/snd` audio output device or available listening/transcription tool in this environment. **No subjective listening occurred.** A separate offline audition ZIP contains all twelve byte-exact shipped files and a six-cue HTML player for the owner to listen to; it is not added to the runtime. Real match transition quality, long-session repetition, effects masking and physical-device audio remain listening tasks.

## Third-party runtime attribution

The production JavaScript contains Vite 6.4.3's modulepreload helper. Its MIT copyright and permission notice was absent from the prior source/site distribution. The candidate adds [`public/THIRD_PARTY_NOTICES.txt`](../public/THIRD_PARTY_NOTICES.txt), which is copied into `dist` and precached within `/rts-game/`. The exact notice comes from the locked installed Vite package and was checked against the [tagged Vite license](https://github.com/vitejs/vite/blob/v6.4.3/packages/vite/LICENSE.md); the helper is in the [tagged primary source](https://github.com/vitejs/vite/blob/v6.4.3/packages/vite/src/node/plugins/modulePreloadPolyfill.ts).

This is third-party runtime **code**, not a third-party art or music pack. Development dependencies and synthesis build tools are not all browser runtime assets. Adding a notice does not assign a new project-wide license to the owner's game or generated/reference art.

## Original-prompt content inventory

Read-only imports of typed content and authored route definitions yield:

| Content | Implemented definitions |
| --- | --- |
| Factions / commanders / commander abilities | 3 / 3 / 6 |
| Troop types / building types / technologies | 6 / 9 / 6 |
| Biomes / AI personality types / game modes | 4 / 6 / 4 |
| Authored stories / missions | 2 / 8: Rise of the Frontier 5, Ember Road 3 |
| Expedition definitions / node kinds / loadouts | 13 / 7 / 3 |
| Rush upgrades / achievements / persistent choices | 6 / 30 / 9 |

The nine building definitions include the starting Keep, which cannot be replaced; eight are constructible. Four modes are Domination, Conquest, Relic and Rush. Graph enumeration finds 48 complete authored expedition paths, each seven stops and four battle/elite/boss stops. Thirteen total branching nodes does not contradict the seven-stop route description. Definition counts and graph traversal are architecture/content evidence, not proof that every route has been naturally completed or is enjoyable.

These quantities satisfy the original brief's approximate vertical-slice content counts. Full online multiplayer, authored eight-direction animation, independent complete faction/theme packs, physical iOS/Safari behavior, natural end-to-end routes, broad balance and commercial reference-rights verification remain bounded gaps tracked in [REQUIREMENTS_STATUS.md](REQUIREMENTS_STATUS.md). The original brief permits a useful working subset; it does not permit fake actions or unsupported completion claims.

## Concrete mission content correction

At 35 seconds in Siege of Ironwatch, the published dialogue says “Workshops need a barracks,” but the canonical prerequisite chain is Barracks → Blacksmith → Rune Workshop. The Build preview correctly reports `Requires Blacksmith.` and disables confirmation at an otherwise legal site. The candidate dialogue now explicitly tells the player to build a Blacksmith after the Barracks, then unlock the Workshop.

Before/after browser checks use a **clearly labeled progression fixture** to open Ironwatch; the mission clock, dialogue and placement/recruit controls remain native. This does not claim the chapter was naturally unlocked or won. The natural campaign evidence remains separate.

## Continued earned phone campaign

One continuous Broken Alliance attempt starts from the manually saved, naturally earned 2.2-second chapter checkpoint after Outpost and Hold the Line. No simulation mutation, injected winner, resource grant or fixture unlock is used. The phone is 390×844 CSS pixels with actual touch on uncovered map destinations. Native recruitment, construction, selection, movement, capture, abilities and pause orders are exercised.

The truce expires at 180 seconds; the former ally becomes hostile. The 1,200-gold collection objective is met at 325.6 seconds. A centre-relic push temporarily earns that beacon at 400.8 seconds, but it is retaken; north and south attempts lose the commander and attacking army. The bounded attempt stops at 465.8 seconds with a healthy 5,600/5,600 Keep, two of three mandatory objectives and no owned relics. It is **unfinished**, not a win or terminal defeat. It adds no profile victory or later chapter unlock. A twenty-two-swordsman northern guard cluster is observed earlier in this attempt; its strength is a recorded difficulty/balance observation, not proof of a simulation defect.

The native manual Save and Continue preserve the complete saved battle envelope byte-for-byte at 465.8 seconds, including match identity, campaign session, expedition, tutorial and learning data. The profile remains six games / three wins and the two earned chapters. Twenty-five observations/screenshots and 141 driver input records are preserved; those input records include reads/batches and are not a physical-click count. There is one recovered driver selector mistake and zero uncaught game errors. Repeated coached retries were stopped in favor of this concrete content audit and fix. A complete naturally earned campaign or successful four-battle expedition remains unverified.

## Candidate scope

This candidate changes the one mission dialogue, supplies the runtime notice, updates asset provenance and adds this report/index references. All fifteen `src/sim` files and all existing art/audio/icon/manifest bytes remain identical to the published `fc-10d287331fd1` baseline. It is prepared for lead review and batching; cloud QA has not committed, pushed, run GitHub Actions or deployed it. Validation receipts identify the candidate separately from the still-published runtime.

## Executed candidate gate

**Build `fc-ecbc0d4070f9`.** The candidate passes **536 unit/contract tests in 57 files**, TypeScript and the production build with eight validated missions. Its full **319-case** desktop/portrait/landscape/PWA run has **298 passes, 21 intentional skips, zero failures/flakes**; three separately executed upgrades from the actual published cache fulfill three skips, giving **301 verified cases / 18 remaining skips within the same 319 cases**. All four PWA cases pass. Candidate runtime `index-DOFdeVPS.js` / `index-CH0dYD5l.css`; cache `410dfd12508c`; 25 precached files; 27 byte-identical repeat-build outputs; `/rts-game/` base. Three native Ironwatch before/after candidate views, complete owned-save equality online/offline and real WebAudio signal checks provide separate bounded evidence, without inflating the suite count. The complete patched source reproduces 235 cloud source files; apply onto the lead’s 234-file docs baseline while preserving its additional publication document (expected 236 parent source files). All twenty-six relative Markdown links across the seven changed paths resolve.
