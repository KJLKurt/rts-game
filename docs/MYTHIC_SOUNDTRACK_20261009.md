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
