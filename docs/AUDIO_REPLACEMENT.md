# Frontier Command: original music and replacement guide

Four original, sample-free cues are included. The core runtime manifest exposes only the two requested gameplay tracks; menu and victory are optional additions.

| Cue | Title | Meter / tempo | Key | Exact decoded duration | Behavior |
| --- | --- | --- | --- | --- | --- |
| Exploration | Lanterns in the Pines | 4/4, 96 BPM | D major | 80.000 s / 32 bars | Loop |
| Combat | Clockwork Brigade | 4/4, 96 BPM | B minor | 80.000 s / 32 bars | Loop |
| Menu | Welcome to the Winter Workshop | 4/4, 96 BPM | D major | 40.000 s / 16 bars | Loop |
| Victory | A Banner in the Snow | 4/4, 96 BPM | D major | 7.500 s | Play once |

## Sound and musical structure

Exploration alternates a warm celesta melody with a breathy flute answer, supported by unhurried harp arpeggios, soft sustained harmony, and a round bass. The second 16-bar phrase changes the lead and adds answering notes instead of repeating the first half unchanged.

Combat keeps the same tempo and related key while increasing movement through wooden eighth-note figures, rounded horn phrases, restrained drums, and a flute/horn development in its second half. It is intended to feel like a determined toy brigade rather than frightening or aggressive horror music. There are small synthesized sleigh-bell accents, without quoting an existing Christmas song.

Menu is a quieter, percussion-free version of the exploration theme. Victory is a short rising statement ending on D major, with a natural fade.

## Runtime integration

1. Copy the contents of `assets/` to the game's `public/assets/audio/` folder. The main `manifest.json` contains `exploration` and `combat` entries with the exact requested fields. Optional fields add title/key/bar metadata.
2. Resolve each `src` relative to the application's document/base URL. The paths deliberately have no leading slash, so subpath hosting can work too.
3. Prefer the `.ogg` file when it decodes successfully. Use `.mp3` as a fallback. Do not download both formats on a normal playback path. Both have been independently decoded and checked for exact sample counts.
4. Unlock audio only after a user gesture. Keep existing master/music/effects controls. Multiply the music bus level by the entry's `volume`; these are conservative starting values, not a replacement for the user's slider.
5. For the most precise loop, decode once into an AudioBuffer and use `AudioBufferSourceNode.loop = true`, `loopStart = 0`, and the supplied `loopEnd`. The loop boundary includes wrapped release/reverb, with no intro silence or fade-out hole. HTML audio looping can add device-specific scheduling gaps, so use decoded Web Audio if a gap is noticed.
6. Crossfade exploration/combat over about 1.5–2 seconds. For musical transitions, queue the new cue on the next bar boundary (one bar = 2.5 seconds); an immediate short crossfade is acceptable when urgency matters. Do not retrigger music for every attack: hold combat mode for roughly 8–12 seconds after the last engagement, using the game's existing state policy.
7. Preserve source gain headroom for overlapping event SFX. Avoid normalizing each asset separately at runtime.
8. Core files total approximately 3.8 MB including both codecs. The optional menu/victory pair keeps the entire set below 5 MB. Cache only one supported codec per cue if the service worker supports conditional precaching. Do not precache WAV masters.

The optional entries are in `optional-manifest.json`. To add another visual theme, keep the same state IDs and resolve them through a theme-specific manifest. The music/UI contract need not change.

## Replacing these tracks later

Keep filenames and manifest entry IDs, or change only the paths in `manifest.json`. The source of truth for loop timing is the finished audio itself: update `duration`, `loopStart`, and `loopEnd` after measuring the replacement. Never assume a music generator obeyed the exact requested duration or BPM.

Delivery requirements for a replacement:

- Instrumental, no voice, no spoken countdown, no copyrighted melody quotation.
- 96 BPM, 4/4; preferably D major for exploration and B minor for combat, with a shared motif and compatible timbral palette.
- A musical phrase length of 16 bars (40.000 s) or 32 bars (80.000 s); these originals use 32.
- Loop begins on the first downbeat; no count-in, dramatic one-shot intro, fade-in, end fade, or forced final sting.
- Supply a stereo WAV master, preferably 44.1 or 48 kHz / 24-bit, plus a version with the final reverb tail available separately or baked across the start for seamless looping.
- Target roughly -19 LUFS integrated for background music with true peak at or below -3 dBTP. Keep a controlled low end and clear midrange for small speakers; avoid fatiguing high-frequency bells.
- Encode Ogg Vorbis around quality 3–4 and MP3 at 112–128 kbps. Check decoded duration and the actual loop join after encoding.
- Retain the music generator's applicable output license/terms with the replacement. No third-party music service was used for the initial assets.

## Optional Google music-generation prompts

These are prompts for whichever Google music-generation product the user chooses to use. No particular product, duration capability, account access, or license is assumed. If the tool cannot produce 80 seconds directly, ask for a 16-bar, 40-second version and update the manifest after editing and measurement.

### Exploration prompt

Create an original instrumental seamless-loop game soundtrack called “Lanterns in the Pines” for a warm toy-fantasy Christmas real-time strategy game. 96 BPM, 4/4, D major, exactly 32 bars / 80 seconds if supported. Welcoming, curious, gently adventurous, pleasant during long resource-gathering and building sessions. Use soft celesta or felted music-box tones for a memorable original melody, airy wooden flute replies, delicate harp or plucked strings, warm quiet strings, round acoustic-style bass, and very restrained small percussion. Add subtle sleigh-bell color sparingly. A clear 8-bar melodic theme should develop across four phrases, with a lighter third phrase and a satisfying return. Rich but simple major/add9/relative-minor harmony. Keep transients soft, bass controlled, and high bells smooth so it works on a phone speaker. No vocals, no narration, no holiday-song quotations, no reference to a named artist, no harsh chiptune beeps. Start immediately on a downbeat; no count-in, fade-in, big introduction, final ending, or fade-out. The last bar must lead naturally back to the first. Export a clean stereo master and preserve the reverb tail for a seamless loop edit.

### Combat prompt

Create an original instrumental seamless-loop battle soundtrack called “Clockwork Brigade” for the same warm toy-fantasy Christmas strategy game. 96 BPM, 4/4, B minor with occasional D-major lift, exactly 32 bars / 80 seconds if supported. Determined, engaging, playful tactical momentum; suitable for a toy army, without horror or overwhelming aggression. Use rounded short brass/horn phrases and wooden marimba or pizzicato eighth-note patterns, lyrical flute answers, soft orchestral strings, restrained low drums and brushed snare, round bass, and only a few quiet sleigh-bell accents. Related sonic palette to a celesta/flute/harp exploration theme. Strong original melodic identity with four 8-bar phrases and meaningful orchestration development; leave room for game sound effects. No vocals, no narration, no existing melody, no named-artist imitation, no piercing brass, distorted synth, heavy trailer impacts, constant cymbal wash, or harsh beeps. Begin on a downbeat, avoid a one-shot opening flourish, and make the final bar turn back to B minor at the first bar without a finale or fade. Export a stereo master with the loop-tail material available.

## Source, regeneration, and provenance

- `compose_frontier.py`: complete deterministic score, instruments, arrangement, room processing, mastering and codec commands.
- `masters/*.score.json`: machine-readable note/percussion events.
- `masters/*.mid`: editable Standard MIDI score using approximate GM instrument labels. The supplied WAVs use the original synthesizer, not GM soundfonts.
- `masters/*.wav`: 44.1 kHz stereo PCM masters.
- `verify_audio.py`: encoded-duration, level, DC, clipping and seam checks.
- `validation.json`: resulting technical measurements.
- `browser-validation.json`: browser-verification status and any environment limitation.
- Seed: `20261004`, plus the sum of character codes in each track ID. No copyrighted recordings or third-party sample packs are used.

Regenerate with `python3 compose_frontier.py`, then `python3 verify_audio.py`. Python requires NumPy and SciPy, plus the installed FFmpeg command. No internet or account is involved.

## Verification limitation

Audio output was attempted through the available audio interface, but this agent session explicitly reported that it does not support audio input. Therefore subjective listening quality has not been claimed as verified. The composition, waveform continuity, clipping/headroom, stereo/mono compatibility and encoded duration are checked separately. Browser verification was attempted, but local Chromium could not create its runtime socket and the supported cloud browser blocked the local audition URL; no successful browser-playback claim is made. Please audition in the actual game before calling the mix artistically final; the included originals are designed to be replaceable.
