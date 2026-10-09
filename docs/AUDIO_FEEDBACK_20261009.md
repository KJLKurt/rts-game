# Construction and combat audio feedback — 9 October 2026

Original brief section 32 calls for useful construction, sword and arrow feedback with sensible concurrency limits. The simulation already emitted construction-completion, melee-attack and projectile events, but the application ignored them. Damage used one generic 80 Hz tone. This batch connects those existing events to original sample-free synthesis.

## Resulting behavior

- Owned construction completion plays a 523/659/784 Hz cadence. Placement/setup events do not trigger it; placement acknowledgement keeps its existing lower cue.
- Melee releases play a short inharmonic metal impact. Archer and Ranger releases play a bow-string pluck with a falling air tone. Arcane, siege and building projectiles are not mislabeled as arrows.
- Owned attacks and visible foreign sources can be heard. A hidden foreign source stays silent, even if its target is visible. Silent events still advance the event cursor.
- Release and same-tick damage share a 90 ms combat slot. Effects retain their per-kind cooldowns and 12-note cap; whole cues are admitted atomically. Completion may displace incidental effects, but cannot interrupt alert/error voices. Music retains its separate 32-note procedural budget.
- Continue now restores the consumed-event cursor to `nextEventId - 1`. Previously it used the next unused ID and skipped the first new event after loading. Saved events remain consumed.

All effects retain trusted-gesture unlocking and the existing master, mute and effects buses. No simulation, balance, profile, command or save-format change was made. All 16 simulation files and 30 public asset files match the previous live source byte for byte. Existing music and codecs are unchanged.

## Evidence and exact scope

Base/rollback: `6be9680a53726833cc565fa6b9aac69f34272fa9`. Candidate runtime: `fc-453d19bb919d`; offline cache `94b005158b11`, 38 files.

- Final local unit suite: **915 passed in 82 files**. TypeScript and production build passed. Independent source review covered event visibility, restore ordering, effect admission, warning priority, bus routing and cleanup.
- [Initial focused run 37921276948](https://github.com/KJLKurt/rts-game/actions/runs/37921276948), commit `f5fec71e40b7687c71ccb1c8aabff08cd49efbc4`: **9 passed, 6 failed**, zero retries/skips/flaky results, 35.966 seconds. All three combat-signal cases, three existing codec cases and three existing interruption cases passed. The six failures stopped at an ambiguous test locator matching both Settings “Close dialog” and “Done”; their remaining paths were unexecuted.
- [Six-case continuation 37922457238](https://github.com/KJLKurt/rts-game/actions/runs/37922457238), commit `87280f146f5eb3ba7aef90583856f81694d67e22`: **6 passed**, zero retries/skips/flaky results, 59.916 seconds. Production bytes were unchanged. Tests use the exact Settings Done control and the proven legal initial House preview; first-future-event and replay assertions remain strict.

This is **multipart focused acceptance of 15 distinct identities**, not a clean single run or a full-matrix result. QA used two workers, zero retries, no early failure cutoff, a 45-second per-case timeout and a 10-minute test cap. The release retains the full default workflow/configuration; the scoped QA override is not shipped.

On desktop, 390×844 and 844×390 Chromium touch-emulation projects, the saved House was restored at 0.999 progress and completion emitted ID 16, exactly the saved next unused ID. Its cue played once. Actual master/effects gains were approximately 0.4/0.2, interruption reduced master below 0.00005, and trusted recovery restored it. Real AudioContext suspension prevented new effects. Both visual themes were exercised. The Settings screenshot and all event/gain receipts were reviewed.

Native oscillator schedules were re-rendered through OfflineAudioContext into a 1.95-second, mono, 24 kHz WAV: completion, melee, arrow. Peaks were approximately 0.07940, 0.08787 and 0.03810; all signals were nonzero, unclipped and numerically distinct across all three projects. This proves signal generation and routing, not perceived quality. WAV SHA-256: `8158433c922feb6ba8ae071f5e3cefc7dfcd5d5af77250b6ecd9cc48675f685f`.

Initial artifact 11611833319: 6,397,750 bytes, SHA-256 `5959fba760d87168180b308f31439a881494904b3369227ae0d53c912ca46fae`. Continuation artifact 11612731763: 982,890 bytes, SHA-256 `59227bdc839a0901a6754ecedf895c5f07f1346fa88c9212e3789ea38ad703ac`. Both original ledgers and failure evidence are preserved.

## Limitations

These are isolated scripted tests. Near-completion timing, combat events and visibility interruptions are explicitly controlled fixtures; they are not natural-play claims. Sliders use native keyboard input and the phone action controls use native touch emulation. The actual hosted profile and ended Forager route were untouched.

No supported subjective listening-analysis tool was available. Speaker/headphone listening, dense music/SFX masking, fatigue, physical mobile devices and Safari remain unverified. The generated WAV is a reviewable cue preview, not a recording of a natural battle. Themed music and other substantial content/art gaps remain open. The historical 644-case full run stays 608 passed, 10 failed and 26 skipped; these focused checks do not rewrite it.
