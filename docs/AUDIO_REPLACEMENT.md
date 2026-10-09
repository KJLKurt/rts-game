# Frontier Command: original music and replacement guide

Each visual theme has a bank of six original, sample-free cues. The table below describes the preserved Christmas suite; the distinct Mythic bank is documented in MYTHIC_SOUNDTRACK_20261009.md. No third-party music service, copyrighted recording, sample pack, soundfont or external account was used. Celesta, flute, harp, soft pads, rounded bass and restrained percussion tie the states together.

| State | Title | Key | Meter / tempo | Decoded duration | Behavior |
| --- | --- | --- | --- | --- | --- |
| Menu | Welcome to the Winter Workshop | D major | 4/4, 96 BPM | 40.000 s / 16 bars | Loop |
| Exploration / peace | Lanterns in the Pines | D major | 4/4, 96 BPM | 80.000 s / 32 bars | Loop |
| Tension | Lanterns on Watch | B minor | 4/4, 96 BPM | 40.000 s / 16 bars | Loop |
| Combat | Clockwork Brigade | B minor | 4/4, 96 BPM | 80.000 s / 32 bars | Loop |
| Victory | A Banner in the Snow | D major | 4/4, 96 BPM | 7.500 s | Once, then silence |
| Defeat | Gather the Fallen Banners | B minor | 4/4, 96 BPM | 10.000 s | Once, then silence |

## Arrangement

Exploration alternates celesta melody with a breathy flute answer above unhurried harp, sustained harmony and round bass; the second half changes the lead and adds answering notes. Combat develops a related motif with wooden eighth-note patterns, rounded horn, quiet drums and flute answers. Menu is the quieter, percussion-free exploration statement. Victory rises into a complete D-major arrival.

Tension develops combat-motif fragments across 16 bars with spacious flute/horn answers, marimba figures, B-minor-related harmony and sparse low tom/shaker rhythm. Defeat is a reflective descending phrase that settles on B minor with harp replies and a natural release. These are full musical arrangements, not short placeholder outcome beeps.

## Runtime contract and gesture gating

- `start(state = "exploration")` arms active music without creating or resuming an AudioContext. It is safe during initial rendering. `start("peace")` aliases exploration. If no context exists, the pending state stays silent and no assets or scheduler start yet.
- Call `unlock()` only from a real pointer or keyboard gesture. It creates/resumes the context and begins an armed score. Either `start("menu"); unlock()` or `unlock(); start("menu")` works in a gesture. Repeated unlock calls do not restart music. If autoplay resume is rejected, a later genuine gesture can retry it.
- `setTheme("christmas" | "mythic")` selects the bank without changing state or volume. The app calls it only after the requested art theme succeeds; failed or superseded art loads retain the working music theme. The existing visual-theme preference also restores music, with no save-format change. Completed outcomes remain quiet across theme changes and app interruption/resume.
- `setState(state)` changes active or pending music without activating a stopped director. Use it for menu, match and result navigation after starting the director. `stop()` fades music and clears its scheduler; use `start(state)` to reactivate afterward.
- `setCombat(intensity)` accepts the existing 0–1 engagement signal during gameplay states. At 0.04 it selects tension; at 0.22 it selects combat. Combat holds for 10 seconds after the last qualifying signal, then passes through tension until 14 seconds. Continued low-intensity activity renews a four-second tension hold. Menu and outcomes ignore this signal. These timers use audio time and never affect the simulation.
- Use `setState("victory")` / `setState("defeat")` once for the result screen. Legacy `play("victory")` / `play("defeat")` selects the full coda too. Repeated calls do not restart it; after it finishes, the result screen remains quiet. Explicitly select menu or exploration for the next flow.
- Normal state changes crossfade over approximately two seconds; outcomes fade faster for prompt feedback. Cues start from their beginnings and transitions are not quantized to a bar. The outgoing track continues while the requested cue decodes. Older asynchronous loads cannot override newer navigation or restart stopped music.

## Volume, loading and offline behavior

Master, Music, Effects and mute retain the existing persisted preference contract. Their separate buses affect sounds already playing. Each manifest volume multiplies the Music level exactly once, while Master/mute applies to both music and effects. AudioDirector does not write storage; the application saves the existing preferences.

The director loads only the requested cue, trying Ogg first and MP3 only if Ogg fails to fetch or decode. Both banks share at most three cached cue promises, including pending fetches/decodes, and at most two connected track sources during a crossfade. A fourth request waits when every cache slot is still pending; stale requests cannot claim newly available slots. Rapid navigation may retire the oldest fading source early. Missing or undecodable assets use a restrained, state-aware procedural score with finite outcome phrases.

Paths remain under `assets/audio/`, resolved against Vite's base URL, including `/rts-game/`. Remote URLs and parent-directory paths are ignored. Loop bounds are checked against decoded duration. The existing recursive service-worker precache includes both manifests and both banks’ codecs; exact sizes are recorded in the validation reports. WAV masters are not shipped. Source synthesis performs no network calls and requires no accounts.

## Interaction feedback and accessibility

Effects include select, click, order, error, build, complete, recruit, capture, ability, hit, melee, arrow, upgrade, research, repair, resource, destroy and alert. Rising approval/completion cues differ from lower falling denial/destruction contours; alert has a separate repeating contour. They use the independent Effects bus and contain no samples.

The director caps effects at 12 oscillator notes and procedural music at 32. Hit, melee and arrow share a 90 ms combat slot so a release and its same-tick damage do not stack. Click/select have a 60 ms per-kind cooldown, hit 90 ms, and other effects 180 ms. Error/alert/construction completion can displace older incidental effects at the cap. Finished nodes disconnect.

Owned construction completion (`build` event, `complete` subtype) plays a distinct 523/659/784 Hz cadence. Placement acknowledgement retains its original lower cue. Actual melee attack events use a short additive metal impact with inharmonic partials; archer/Ranger projectile events use a bow-string pluck and falling air tone. Other projectile types are not mislabeled as arrows. Owned releases and currently visible foreign sources are audible; hidden foreign releases are silent. The existing event cursor consumes each event once, including silent events, and save restoration starts at the last consumed ID rather than the next unused ID. Audio remains presentation only and does not alter damage or projectile timing.

Pair each cue with visible selection, status, warning text, construction progress or a result screen. Audio is never the only way to discover a denied order, threat or outcome. Do not imply that an accepted/queued action has completed: trigger completion cues at the relevant completion event. The application owns visual/live-region feedback and event wiring; the director owns sound.

## Replacing music later

Change `public/assets/audio/manifest.json` for Christmas or `public/assets/audio/mythic/manifest.json` for Mythic, and their encoded assets, while retaining all six state IDs. `peace` is an API alias, not a seventh manifest entry. The director reads `src`, optional `fallback`, `volume`, `loop`, `loopStart` and `loopEnd`; `duration`, `bpm`, `title`, `key`, `bars` and `timeSignature` describe the delivery. Menu/exploration/tension/combat should loop; outcome states always play once. Do not normalize tracks at runtime or alter user preference values to compensate for new music.

Replacement requirements:

- Original instrumental music with no voice, existing song quotation or named-artist imitation.
- A compatible palette and harmony within each bank. Christmas uses 96 BPM, 4/4, D major / B minor. Mythic uses 96 BPM, 4/4, E modal/minor with a major victory arrival. Preserve each bank’s authored identity and measured phrase lengths.
- Loops begin on a downbeat with no count-in, end sting, fade-out gap or one-shot intro. Wrap release/reverb through the join. Outcome cues may end and fade naturally.
- Keep a stereo WAV master and deliver both Ogg and MP3. Future authored masters may use 44.1/48 kHz, 24-bit; these originals use dithered 44.1 kHz, 16-bit PCM.
- Aim near -19 LUFS for background music and below -3 dBTP true peak. Control low end and high bells. Short codas can have different integrated loudness, with conservative manifest gain and actual transition review.
- Encode Ogg Vorbis around quality 3–5 and MP3 at 112–128 kbps. Measure finished-codec duration, clipping, DC and loop joins; never assume requested duration/BPM were achieved.
- Preserve applicable service licenses and provenance if replacements use another service. This initial suite uses no third-party music service.

## Optional Google music-generation prompts

These are prompts for whichever Google music-generation product the user chooses to use. No particular product, duration capability, account access, or license is assumed. If the tool cannot produce 80 seconds directly, ask for a 16-bar, 40-second version and update the manifest after editing and measurement.

### Exploration prompt

Create an original instrumental seamless-loop game soundtrack called “Lanterns in the Pines” for a warm toy-fantasy Christmas real-time strategy game. 96 BPM, 4/4, D major, exactly 32 bars / 80 seconds if supported. Welcoming, curious, gently adventurous, pleasant during long resource-gathering and building sessions. Use soft celesta or felted music-box tones for a memorable original melody, airy wooden flute replies, delicate harp or plucked strings, warm quiet strings, round acoustic-style bass, and very restrained small percussion. Add subtle sleigh-bell color sparingly. A clear 8-bar melodic theme should develop across four phrases, with a lighter third phrase and a satisfying return. Rich but simple major/add9/relative-minor harmony. Keep transients soft, bass controlled, and high bells smooth so it works on a phone speaker. No vocals, no narration, no holiday-song quotations, no reference to a named artist, no harsh chiptune beeps. Start immediately on a downbeat; no count-in, fade-in, big introduction, final ending, or fade-out. The last bar must lead naturally back to the first. Export a clean stereo master and preserve the reverb tail for a seamless loop edit.

### Combat prompt

Create an original instrumental seamless-loop battle soundtrack called “Clockwork Brigade” for the same warm toy-fantasy Christmas strategy game. 96 BPM, 4/4, B minor with occasional D-major lift, exactly 32 bars / 80 seconds if supported. Determined, engaging, playful tactical momentum; suitable for a toy army, without horror or overwhelming aggression. Use rounded short brass/horn phrases and wooden marimba or pizzicato eighth-note patterns, lyrical flute answers, soft orchestral strings, restrained low drums and brushed snare, round bass, and only a few quiet sleigh-bell accents. Related sonic palette to a celesta/flute/harp exploration theme. Strong original melodic identity with four 8-bar phrases and meaningful orchestration development; leave room for game sound effects. No vocals, no narration, no existing melody, no named-artist imitation, no piercing brass, distorted synth, heavy trailer impacts, constant cymbal wash, or harsh beeps. Begin on a downbeat, avoid a one-shot opening flourish, and make the final bar turn back to B minor at the first bar without a finale or fade. Export a stereo master with the loop-tail material available.

## Source and regeneration

`scripts/audio/compose_frontier.py` contains all six score tables, sample-free instrument synthesis, room processing, mastering, MIDI/JSON score export and codec commands. The seed is `20261004` plus the sum of character codes in each cue ID.

Run `python3 scripts/audio/compose_frontier.py --output /tmp/frontier-command-audio-recovered` with NumPy, SciPy and FFmpeg installed. `--track tension` (or another state) generates only one cue. Output includes encoded assets and editable MIDI, score JSON and WAV masters. Copy chosen Ogg/MP3 files to `public/assets/audio/`, retaining measured manifest metadata. Do not ship masters.

Defeat uses Vorbis quality 5 because quality 3 showed low-level decoded DC bias in the earlier technical pass; other cues use quality 3. MP3 uses 112 kbps. Synthesis is deterministic within the toolchain; Ogg container serial numbers may vary across encoding runs.

Run `python3 scripts/audio/verify_audio.py` on shipped files. `docs/AUDIO_VALIDATION.json` records fresh SHA-256, exact frame counts, EBU R128 loudness, true peak, clipping, DC, stereo correlation and sample discontinuity measurements for all twelve encoded files. A small loop boundary step is a technical check, not proof of a satisfying musical transition.

## Recovery provenance

The working-directory recovery restored exploration/combat Ogg and MP3 from the verified `242b6df` checkpoint without modifying those binaries. Their original composition/synthesis source was reconstructed from retained source excerpts. Regenerating both cues produced identical decoded PCM SHA-256 for all four codec files, supporting faithful reconstruction of the shared synth/arrangement pipeline.

Menu, tension, victory and defeat were missing from the recovered checkpoint. Their original score and synthesis definitions were reconstructed from the same retained task source excerpts, then regenerated locally. Prior encoded-file byte identity for those eight missing files is unproven and is not claimed. `docs/AUDIO_RECOVERY.json` records retained/reconstructed identities and the decoded baseline comparisons. No new music service, sample pack or account was involved. `scripts/audio/PROVENANCE.txt` records the same distinction.

## Validation and remaining listening gate

The recovery pass runs fresh mocked Web Audio state/gesture/routing/concurrency tests and technical checks of all shipped codecs. The restored `tests/browser/audio.spec.ts` checks actual decoding of all codecs when run against the integrated candidate; it is not counted as passed by a unit/codec-only recovery pass. Existing candidate results do not validate recovered code automatically.

No subjective listening is verified. The earlier task's direct Chromium launch failed at runtime socket creation; no successful browser playback or listening result is inherited. Before claiming commercial sound polish, audition every full loop and both codas in the actual game on headphones and a small phone speaker, including one loop join, menu→match, quiet→tension→combat→quiet, results, repeated navigation, mute/unmute and simultaneous effects. Check continuity, fatigue and readable event feedback at low volume. Musical quality and physical-device listening remain open.
