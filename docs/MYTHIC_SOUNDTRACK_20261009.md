# Mythic soundtrack checkpoint — 2026-10-09

The Mythic art theme now selects a distinct original, sample-free six-state bank. The Christmas codec files, manifest and original composer remain byte-identical. This advances the reopened themed-audio commitment; the original six-state music requirement already had a Christmas implementation.

## Content and signal review

See MYTHIC_AUDIO_PROVENANCE.md for authoring/regeneration, MYTHIC_AUDIO_COMPOSITION_VALIDATION.json for masters, MIDI, score and detailed signal metrics, and MYTHIC_AUDIO_VALIDATION.json for an independent check of the twelve shipped codecs.

The bank uses new E-modal/minor themes, low horns, woodwinds, bowed/plucked strings, bass and restrained percussion. Menu/tension loop at 40 seconds, exploration/combat at 60 seconds; victory/defeat are finite 7.5/10-second codas. All use 4/4 at 96 BPM. Accepted exploration/combat pilot masters, scores, MIDI and codecs were preserved byte-for-byte when authoring the remaining states.

Actual decoded signal inspection covered waveforms, 100 ms RMS/peak envelopes, spectrograms and loop joins for all six states. Twelve codecs total 6,184,487 bytes, all stereo 44.1 kHz with exact decoded durations, no clipping and true peaks at or below −5.70 dBTP. Ogg integrated loudness spans −20.19 to −18.98 LUFS before conservative manifest gain. Estimated level after manifest gain spans −22.92 to −22.12 LUFS, before user buses. This estimate is not an audible game-mix judgment.

Menu/tension lossy-codec seam curvature is 1.50–3.63 times the local 99th percentile at low absolute levels; boundary steps remain below the local first-derivative percentile. This is retained as a review limitation. Codas end below −85 dBFS over their last 100 ms. No subjective listening, physical speaker/headphone audition or fatigue acceptance is claimed.

## Runtime and preservation

A successful visual-theme load selects the matching bank; failed/superseded art loads keep the working bank. The existing preference restores both with no save-schema change. Both banks share three cache entries including pending loads, and at most two connected music sources. Latest-request guards prevent stale starts. Theme changes preserve current state, engagement holds and all volume buses. Completed outcomes remain quiet after theme changes or interruption/resume; a new logical flow can play a new result.

The service worker recursively caches both banks. The candidate production cache contains 51 files with cache ID c144d9672910; runtime fc-a70e1612bc3f. WAV/MIDI/score masters remain editing evidence and are not shipped to the browser. Simulation and prior art/audio asset bytes are unchanged.

## Validation status

Baseline/rollback: 4b724862b31fa3a827d6997355444ae5a87d216d. Local tests: 949 passed in 82 files; TypeScript/content/build passed. One planned isolated gate contains 24 identities across desktop, portrait and landscape: both-codec decoding, native routing/source lifecycle, independent volume/mute, paused save and offline restoration, delayed-load races, theme failure and interruption recovery. Planned identities are not results. The lifecycle test uses explicitly labeled isolated event/result fixtures, not natural victory evidence.

The historical full 644-case result remains 608 passed, 10 failed and 26 skipped. Later focused results do not rewrite that ledger. Physical devices, Safari, subjective audio/game feel, broad visual acceptance, Ironwatch victory and full expedition completion remain open. The hosted profile and ended Forager route are outside this isolated gate.

## Zero-volume defect and focused correction — 13:44 UTC

Initial native run 37935848068 finished 21 passed / 3 failed / 0 skipped / 0 retries. The three failures read an inactive Effects parameter after requesting zero. A test-only three-case continuation, 37937278981, finished 0 passed / 3 failed / 0 skipped / 0 retries on the same production bytes. It measured the actual next selection cue and proved nonzero post-Effects samples despite a zero saved preference: peak 0.016414 on desktop/portrait and 0.001739 on landscape. The first result was not merely dismissed as an observation issue.

The bounded production correction cancels automation and schedules exact zero for effective zero on Master, Music and Effects, including mute. Positive changes keep the original smoothing. Source crossfades, fallback voices, budgets and simulation remain unchanged. The new candidate is runtime fc-8228b96098aa, cache b135ebdef351, with 51 cached files; all assets remain byte-identical to the initial Mythic candidate.

All 962 local unit tests in 82 files and the build pass. The nine-identity gate 37938943265 (QA commit 4bdc1265294eda9908b8828f482c8d1b25a0d0e5) is running, not accepted yet. It requires actual rendered zero on all three buses, positive restoration, future cues/source changes, interruption recovery, muted offline save/reload, no coda replay and the shared source cap. Passive native analysers preserve audible routing; every cue measurement must occur after a complete analyser window and before the real selection envelope ends. Completed-coda dormant gain is checked by its scheduled values and lack of output sources, with restored positive gain verified only on genuine new menu playback.

Both failed ledgers and their source/asset attribution remain retained. Earlier unit and gain-observation passes do not establish complete zero-output or mute acceptance. Main remains 4b724862; no deployment is authorized by this QA checkpoint alone.

## Accepted focused result — 13:50 UTC

Run37938943265 completed9passed/0failed/0skipped/0retries on fc-8228b96098aa. Native measurements were reviewed: Music zero, Effects zero, Master zero, Master-zero interruption recovery, Mute after theme changes, and Mute after offline reload all produced an observed peak of exactly0 in every viewport. Effects restoration produced peak0.01009–0.01097; Master restoration and offline unmute were positive. Cues were measured inside their actual220ms envelope, not merely after they ended.

All26 codec/manifest files were cached, paused game/profile comparisons survived offline reload, both finite codas ended/disconnected without replay, and connected music sources never exceeded2. Three Settings frames were inspected at desktop1440×900, portrait390×844 and landscape844×390. Short layouts scroll; these images are actual browser frames, not generated gameplay art.

The original21/3 run and failed0/3 observation continuation remain separate from the clean9-case corrected-runtime gate. Fifteen additional asset-decode/theme identities passed on the preceding Mythic candidate with the same assets, but they were not rerun on the corrected runtime. This is focused incremental acceptance, not a new24-case clean run or a clean full644 matrix. No subjective listening or physical-device acceptance is established. Main remains the rollback4b724862 until a separate release action is authorized.

Artifact11621210546 is1,678,221bytes, SHA256de1277fe2b0e20b936c4e3aeb7cfe82b657f4add44e9b6096711e806c2b774da. The earlier artifacts11617842609 and11618049254 retain their original failures. Release source must retain the default full QA config/workflow, excluding scoped acceptance configs.
