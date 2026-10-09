# Mythic soundtrack bank

Six newly composed, instrumental, sample-free arrangements for Frontier Command.
No music-generation service, artist prompt, commercial recording, sample pack,
soundfont, voice, downloaded instrument, external account or upload was used.
No existing song quotation or named-artist imitation was requested or used.
This describes the authoring process, not an exhaustive music-catalog similarity search.

- Menu: “The Citadel Gates”, E minor / Dorian modal mixture, 16 bars / 40 seconds.
- Exploration: “Banners Above the Vale”, E minor / Dorian mixture, 24 bars / 60 seconds.
- Tension: “Watchfires on the Rampart”, E minor, 16 bars / 40 seconds.
- Combat: “The Ironwatch Muster”, E minor, 24 bars / 60 seconds.
- Victory: “Standards at Dawn”, E major, 3 bars / 7.5 seconds, finite.
- Defeat: “The Silent Courtyard”, E minor, 4 bars / 10 seconds, finite.
- All cues use 4/4, 96 BPM, stereo 44,100 Hz audio.
- The 24-bar exploration/combat form is a deliberate three-section pilot within the requested
  40–80-second range, rather than the earlier guide's preferred 16/32-bar forms.
- Exploration/combat use new melody, harmony and rhythm tables, with three
  eight-bar sections from brass statement through woodwind development to return.
- Menu quietly restates the exploration motif; tension fragments the combat
  theme; victory changes the opening interval cell into an E-major arrival;
  defeat breaks the cell into a descending response and E-minor release.
- Low horns, flutes, bowed strings, muted plucked strings, round bass and quiet
  drum/shaker accents. No celesta, bell or marimba part appears in this bank.
- Original additive viol and lute voices extend compose_frontier.py's synthesis.
  Note model, envelopes, retained oscillator voices, percussion, periodic mixer,
  room-reverb implementation and GM MIDI writer come from that retained source.
- The original composer and all shipped assets are read-only inputs to this task.

## Files and regeneration

Run python3 scripts/audio/compose_mythic.py --output /path/to/evidence/mythic-bank
--preserve-pilots /path/to/evidence/mythic-pilots from the candidate checkout.
This copies accepted exploration/combat WAV, MIDI, score JSON and both codecs
byte-for-byte and renders only the four other states. --track selects one cue.
Without --preserve-pilots all selected cues regenerate; a newer source can differ.
The retained pilot source snapshot is provenance/compose_mythic.pilots.py.
The pilot validation and copied-file hash list preserve that distinct provenance.
Outputs: stereo 16-bit PCM
WAV, editable General MIDI, complete score JSON, Vorbis quality 5 and 128 kbps MP3.
GM instruments approximate the custom voices; a MIDI player will not reproduce
the WAV sound. PCM is deterministic within the recorded toolchain. Encoded Ogg
container bytes can change due to container serials, even with identical PCM.

## Mastering and technical evidence

Release tails and room reflections wrap into the beginning of each loop. The
periodic high-pass (55 Hz) and low-pass (7.6 kHz) controls precede conservative
saturation and fixed loudness gain. Loops have no end fade. Finite outcome
arrangements use a natural tail plus a gentle final 1.6-second fade, never wrapping.
Targets span -20.2 to -19.0 LUFS according to state, capped at -3.8 dBTP
before encoding. TPDF dither is added for 16-bit quantization. validation.json
contains measured codec identity, exact decoded frames, hashes, LUFS, true peak,
DC, clipping, stereo/mono fold-down, one-second RMS variation and loop-boundary
slope/curvature against a local 20 ms neighborhood. Finite outcomes additionally
require their last 100 ms to remain below -55 dBFS.

manifest.json uses assets/audio/mythic/<state>.ogg and MP3 fallback paths, measured
decoded durations, exact loop bounds and the existing conservative per-state
volume multipliers. The gain is applied once by the existing runtime; these are
not changes to user preference values. validation.json estimates post-manifest
LUFS from the measured Ogg loudness and fixed gain; it is not a game-mix measurement.

The transposition check compares each complete lead-melody bar's relative pitch,
rhythm and durations against both retained Christmas lead tables. It is a limited
mechanical distinction check, not proof of musical originality across all works.

## Review limits

No subjective listening, actual game transition audition, physical phone-speaker
test or headphones test is claimed. Low-pass, low-end control, moderate loudness
and a measured mono fold-down are technical precautions, not a listening pass.
A small sample-boundary step does not prove that the musical loop feels natural.
The pilot's independent waveform, spectrogram, RMS and seam review authorized
extension to this six-state bank. That was technical/compositional inspection,
not subjective listening acceptance. Actual device/transition audition remains open.
