/** Original, replaceable offline score. Audio never affects simulation timing. */
import type { VisualThemeId } from "../render/visualThemes";

export type AudioTheme = VisualThemeId;
export type AudioState =
  | "menu"
  | "exploration"
  | "tension"
  | "combat"
  | "victory"
  | "defeat";
export type SoundEffect =
  | "select"
  | "order"
  | "error"
  | "build"
  | "recruit"
  | "capture"
  | "ability"
  | "hit"
  | "melee"
  | "arrow"
  | "complete"
  | "victory"
  | "defeat"
  | "click"
  | "upgrade"
  | "research"
  | "repair"
  | "resource"
  | "destroy"
  | "alert";
interface TrackEntry {
  src: string;
  fallback?: string;
  loop?: boolean;
  loopStart?: number;
  loopEnd?: number;
  volume?: number;
  bpm?: number;
}
interface Track {
  buffer: AudioBuffer;
  entry: TrackEntry;
}
interface CachedTrack {
  promise: Promise<Track | null>;
  pending: boolean;
}
interface MusicVoice {
  state: AudioState;
  source: AudioBufferSourceNode;
  gain: GainNode;
  retiring: boolean;
}
interface NoteVoice {
  source: OscillatorNode;
  gain: GainNode;
  end: number;
  music: boolean;
  priority: number;
}
const STATES: AudioState[] = [
  "menu",
  "exploration",
  "tension",
  "combat",
  "victory",
  "defeat",
];
const MANIFESTS: Record<AudioTheme, string> = {
  christmas: "assets/audio/manifest.json",
  mythic: "assets/audio/mythic/manifest.json",
  halloween: "assets/audio/halloween/manifest.json",
};
const limit = (value: number, fallback: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
const isResult = (state: AudioState) =>
  state === "victory" || state === "defeat";
const isGameplay = (state: AudioState) =>
  state === "exploration" || state === "tension" || state === "combat";

export class AudioDirector {
  private masterVolume = 0.85;
  private muted = false;
  private musicVolume = 0.32;
  private sfxVolume = 0.65;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private fallbackGain: GainNode | null = null;
  private state: AudioState = "menu";
  private theme: AudioTheme = "christmas";
  private active = false;
  private timer = 0;
  private next = 0;
  private beat = 0;
  private combatUntil = 0;
  private tensionUntil = 0;
  private request = 0;
  private manifests = new Map<
    AudioTheme,
    Promise<Partial<Record<AudioState, TrackEntry>>>
  >();
  // Both banks share three slots, including in-flight fetches and decodes.
  private buffers = new Map<string, CachedTrack>();
  private voices: MusicVoice[] = [];
  private notes: NoteVoice[] = [];
  private lastEffect = new Map<SoundEffect, number>();
  private lastCombatEffect = -Infinity;
  private hasTrack = false;
  private resultFinished = false;

  /** Call only from a user gesture. A blocked resume can be retried next gesture. */
  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.master.gain.value = this.muted ? 0 : this.masterVolume;
      this.musicGain = this.context.createGain();
      this.musicGain.connect(this.master);
      this.musicGain.gain.value = this.musicVolume;
      this.effectsGain = this.context.createGain();
      this.effectsGain.connect(this.master);
      this.effectsGain.gain.value = this.sfxVolume;
      this.fallbackGain = this.context.createGain();
      this.fallbackGain.connect(this.musicGain);
      this.fallbackGain.gain.value = 0;
    }
    void this.context.resume().catch(() => {
      /* Autoplay may still require a later gesture. */
    });
    this.beginPlayback();
  }
  setMaster(volume: number, muted = false) {
    this.masterVolume = limit(volume, 0.85);
    this.muted = muted;
    this.setBusVolume(this.master, muted ? 0 : this.masterVolume, 0.05);
  }
  setVolumes(music: number, sfx: number) {
    this.musicVolume = limit(music, 0.32);
    this.sfxVolume = limit(sfx, 0.65);
    this.setBusVolume(this.musicGain, this.musicVolume, 0.15);
    this.setBusVolume(this.effectsGain, this.sfxVolume, 0.05);
  }
  private setBusVolume(bus: GainNode | null, volume: number, smoothing: number) {
    if (!bus || !this.context) return;
    const at = this.context.currentTime;
    if (volume === 0) {
      // Silence must be exact, including when a dormant bus next receives a cue.
      bus.gain.cancelScheduledValues(at);
      bus.gain.setValueAtTime(0, at);
    } else bus.gain.setTargetAtTime(volume, at, smoothing);
  }
  /** Arm music without creating/resuming an AudioContext; unlock only in a gesture. */
  start(state: AudioState | "peace" = "exploration") {
    const resolved = state === "peace" ? "exploration" : state;
    if (!this.active) {
      this.active = true;
      this.hasTrack = false;
      // Returning from blur/pagehide is not a new result announcement.
      if (resolved !== this.state) this.resultFinished = false;
      this.combatUntil = this.tensionUntil = 0;
      this.state = resolved;
    } else this.setState(state);
    this.beginPlayback();
  }
  private beginPlayback() {
    if (!this.active || !this.context || this.timer) return;
    this.resetPhrase();
    this.updateFallback();
    if (!this.resultFinished) void this.loadState();
    this.timer = window.setInterval(() => this.schedule(), 120);
  }
  stop() {
    this.active = false;
    this.request++;
    this.hasTrack = false;
    this.combatUntil = this.tensionUntil = 0;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = 0;
    this.retireVoices(0.15);
    this.updateFallback();
  }
  /** Changes score without bypassing the gesture unlock. Repeated calls are inert. */
  setState(state: AudioState | "peace") {
    const resolved = state === "peace" ? "exploration" : state;
    if (resolved === this.state) return;
    this.state = resolved;
    this.resultFinished = false;
    this.resetPhrase();
    if (!isGameplay(resolved)) this.combatUntil = this.tensionUntil = 0;
    if (this.active && this.context) void this.loadState();
  }
  getState(): AudioState {
    return this.state;
  }
  /** Switch only the score bank; state, combat holds and volume buses persist. */
  setTheme(theme: AudioTheme) {
    if (theme === this.theme) return;
    this.theme = theme;
    // Selecting another look after a result must not celebrate/announce it again.
    if (isResult(this.state) && this.resultFinished) return;
    this.resetPhrase();
    if (this.active && this.context) void this.loadState();
  }
  getTheme(): AudioTheme {
    return this.theme;
  }
  /** Combat holds for 10 seconds, then tension for 4, avoiding attack-by-attack flaps. */
  setCombat(value: number) {
    if (!this.active || !this.context || !isGameplay(this.state)) return;
    const now = this.context.currentTime,
      intensity = limit(value, 0);
    if (intensity >= 0.22) {
      this.combatUntil = now + 10;
      this.tensionUntil = now + 14;
    } else if (intensity >= 0.04)
      this.tensionUntil = Math.max(this.tensionUntil, now + 4);
    this.setState(
      now < this.combatUntil
        ? "combat"
        : now < this.tensionUntil
          ? "tension"
          : "exploration",
    );
  }
  private resetPhrase() {
    this.beat = 0;
    this.next = (this.context?.currentTime ?? 0) + 0.04;
  }
  private getManifest(theme: AudioTheme) {
    let manifest = this.manifests.get(theme);
    if (!manifest) {
      manifest = (async () => {
        try {
          const response = await fetch(
            `${import.meta.env.BASE_URL}${MANIFESTS[theme]}`,
          );
          if (!response.ok) throw Error("Music manifest unavailable");
          const json = await response.json();
          const entries: Partial<Record<AudioState, TrackEntry>> = {};
          for (const state of STATES) {
            const entry = json[state];
            // Assets stay within the offline package, including after replacement.
            const safe = (path: unknown) =>
              typeof path === "string" &&
              /^assets\/audio\/[a-zA-Z0-9_./-]+$/.test(path) &&
              !path.split("/").includes("..");
            if (entry && safe(entry.src))
              entries[state] = {
                ...entry,
                fallback: safe(entry.fallback) ? entry.fallback : undefined,
              };
          }
          return entries;
        } catch {
          return {};
        }
      })();
      this.manifests.set(theme, manifest);
    }
    return manifest;
  }
  private async decodeTrack(theme: AudioTheme, state: AudioState) {
    const entry = (await this.getManifest(theme))[state];
    if (!entry || !this.context) return null;
    for (const src of [entry.src, entry.fallback].filter(Boolean)) {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${src}`);
        if (!response.ok) continue;
        const buffer = await this.context.decodeAudioData(
          await response.arrayBuffer(),
        );
        return { buffer, entry };
      } catch {
        /* Try the alternate codec before using the procedural score. */
      }
    }
    return null;
  }
  private async getTrack(theme: AudioTheme, state: AudioState, request: number) {
    const key = `${theme}:${state}`;
    while (request === this.request && this.active && this.context) {
      const cached = this.buffers.get(key);
      if (cached) {
        // Refresh recency without duplicating a pending decode.
        this.buffers.delete(key);
        this.buffers.set(key, cached);
        return cached.promise;
      }
      if (this.buffers.size >= 3) {
        const settled = [...this.buffers].find(([, entry]) => !entry.pending);
        if (settled) this.buffers.delete(settled[0]);
        else {
          // WebAudio decodes cannot be cancelled. Keep their slots reserved;
          // only the latest request may claim a slot once one finishes.
          // Wait only for capacity, not a Track value retained by another race.
          await Promise.race(
            [...this.buffers.values()].map(entry => entry.promise.then(() => {})),
          );
          continue;
        }
      }
      const entry: CachedTrack = {
        pending: true,
        promise: this.decodeTrack(theme, state).then(track => {
          entry.pending = false;
          return track;
        }),
      };
      this.buffers.set(key, entry);
      return entry.promise;
    }
    return null;
  }
  private async loadState() {
    const request = ++this.request,
      state = this.state,
      theme = this.theme;
    const track = await this.getTrack(theme, state, request);
    if (request !== this.request || !this.active || !this.context) return;
    if (!track) {
      this.hasTrack = false;
      this.retireVoices(0.35);
      this.updateFallback();
      return;
    }
    const at = this.context.currentTime + 0.025;
    this.retireVoices(isResult(state) ? 0.18 : 0.45);
    while (this.voices.length >= 2) this.removeVoice(this.voices[0]);
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = track.buffer;
    source.loop = !isResult(state) && track.entry.loop !== false;
    const start = track.entry.loopStart ?? 0,
      end = track.entry.loopEnd ?? track.buffer.duration;
    source.loopStart =
      Number.isFinite(start) && start >= 0 && start < track.buffer.duration
        ? start
        : 0;
    source.loopEnd =
      Number.isFinite(end) &&
      end > source.loopStart &&
      end <= track.buffer.duration
        ? end
        : track.buffer.duration;
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.musicGain!);
    const voice: MusicVoice = { state, source, gain, retiring: false };
    this.voices.push(voice);
    source.onended = () => {
      if (!voice.retiring && state === this.state && isResult(state))
        this.finishResult();
      this.removeVoice(voice, false);
    };
    source.start(at);
    gain.gain.setTargetAtTime(
      limit(track.entry.volume ?? 0.7, 0.7),
      at,
      isResult(state) ? 0.07 : 0.45,
    );
    this.hasTrack = true;
    this.updateFallback();
  }
  private retireVoices(time: number) {
    if (!this.context) return;
    for (const voice of this.voices) {
      if (voice.retiring) continue;
      voice.retiring = true;
      voice.gain.gain.setTargetAtTime(0, this.context.currentTime, time);
      voice.source.stop(this.context.currentTime + time * 5);
    }
  }
  private finishResult() {
    this.resultFinished = true;
    // A slow theme/state load must not start a second coda after this one ends.
    this.request++;
  }
  private removeVoice(voice: MusicVoice, stop = true) {
    const index = this.voices.indexOf(voice);
    if (index < 0) return;
    this.voices.splice(index, 1);
    voice.source.onended = null;
    if (stop) voice.source.stop();
    voice.source.disconnect();
    voice.gain.disconnect();
  }
  private updateFallback() {
    this.fallbackGain?.gain.setTargetAtTime(
      this.active && !this.hasTrack && !this.resultFinished ? 0.18 : 0,
      this.context!.currentTime,
      0.25,
    );
  }
  private removeNote(voice: NoteVoice, stop = false) {
    const index = this.notes.indexOf(voice);
    if (index < 0) return;
    this.notes.splice(index, 1);
    voice.source.onended = null;
    if (stop) voice.source.stop();
    voice.source.disconnect();
    voice.gain.disconnect();
  }
  private note(
    freq: number,
    duration: number,
    at: number,
    volume: number,
    wave: OscillatorType = "sine",
    music = true,
    attack = 0.025,
    endFrequency?: number,
    priority = 0,
  ) {
    if (!this.context || !this.master) return;
    for (const voice of [...this.notes])
      if (voice.end <= this.context.currentTime) this.removeNote(voice);
    if (
      this.notes.filter((voice) => voice.music === music).length >=
      (music ? 32 : 12)
    )
      return;
    const osc = this.context.createOscillator(),
      gain = this.context.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    if (endFrequency !== undefined) {
      osc.frequency.setValueAtTime(freq, at);
      osc.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
    }
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume),
      at + attack,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(music ? this.fallbackGain! : this.effectsGain!);
    const voice = { source: osc, gain, end: at + duration + 0.02, music, priority };
    this.notes.push(voice);
    osc.onended = () => this.removeNote(voice);
    osc.start(at);
    osc.stop(voice.end);
  }
  /** Admit whole cues; completion may displace incidental sounds, never warnings. */
  private reserveEffects(count: number, priority: number): boolean {
    const at = this.context!.currentTime;
    for (const voice of [...this.notes])
      if (voice.end <= at) this.removeNote(voice);
    const effects = this.notes.filter(voice => !voice.music);
    const needed = effects.length + count - 12;
    if (needed <= 0) return true;
    const replaceable = effects.filter(voice => voice.priority < priority)
      .sort((a, b) => a.priority - b.priority);
    if (replaceable.length < needed) return false;
    for (const voice of replaceable.slice(0, needed)) this.removeNote(voice, true);
    return true;
  }
  private schedule() {
    if (
      !this.context ||
      !this.active ||
      this.context.state !== "running" ||
      this.hasTrack ||
      this.resultFinished
    )
      return;
    const ctx = this.context,
      result = isResult(this.state);
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.04;
    while (this.next < ctx.currentTime + 0.35) {
      if (result && this.beat >= (this.state === "victory" ? 24 : 32)) {
        this.finishResult();
        return;
      }
      const minor =
        this.state === "tension" ||
        this.state === "combat" ||
        this.state === "defeat";
      const chords = minor
        ? [
            [123.47, 185, 246.94, 293.66],
            [98, 146.83, 196, 246.94],
            [110, 164.81, 220, 277.18],
            [123.47, 185, 246.94, 293.66],
          ]
        : [
            [146.83, 220, 293.66, 369.99],
            [123.47, 185, 246.94, 293.66],
            [98, 146.83, 196, 246.94],
            [146.83, 220, 293.66, 369.99],
          ];
      const chord = chords[Math.floor(this.beat / 8) % 4];
      if (this.beat % 8 === 0) {
        for (const f of chord)
          this.note(f, result ? 1.7 : 2.4, this.next, 0.11);
        this.note(chord[0] / 2, 1.7, this.next, 0.19, "triangle");
      }
      const order =
        this.state === "defeat"
          ? [3, 2, 1, 2, 1, 0, 1, 0]
          : [0, 2, 1, 3, 2, 1, 3, 2];
      if (this.state !== "menu" || this.beat % 2 === 0)
        this.note(chord[order[this.beat % 8]] * 2, 0.65, this.next, 0.14);
      if (
        this.state === "combat" ||
        (this.state === "tension" && this.beat % 4 === 0)
      )
        this.note(
          this.beat % 2 === 0 ? 58 : 87,
          0.14,
          this.next,
          0.17,
          "triangle",
        );
      this.beat++;
      this.next += 60 / 96 / 2;
    }
  }
  play(kind: SoundEffect) {
    if (!this.context || this.context.state !== "running") return;
    if (kind === "victory" || kind === "defeat") {
      this.setState(kind);
      return;
    }
    const at = this.context.currentTime;
    // Release and damage can occur in the same simulation tick. One shared
    // combat slot keeps the release audible without stacking its generic hit.
    const combat = kind === "hit" || kind === "melee" || kind === "arrow";
    if (combat && at - this.lastCombatEffect < 0.09) return;
    const cooldown =
      kind === "hit"
        ? 0.09
        : kind === "select" || kind === "click"
          ? 0.06
          : 0.18;
    if (at - (this.lastEffect.get(kind) ?? -Infinity) < cooldown) return;
    this.lastEffect.set(kind, at);
    if (combat) this.lastCombatEffect = at;
    if (kind === "melee") {
      if (!this.reserveEffects(4, 0)) return;
      // Original additive metal impact: inharmonic partials, short sharp attack.
      for (const [frequency, duration, volume] of [[145, .075, .08], [1260, .13, .055], [1817, .095, .035], [2943, .055, .025]])
        this.note(frequency, duration, at, volume, "sine", false, .003);
      return;
    }
    if (kind === "arrow") {
      if (!this.reserveEffects(2, 0)) return;
      // Original bow-string pluck and a quiet falling air tone, unlike the clank.
      this.note(960, .065, at, .075, "triangle", false, .003, 220);
      this.note(2400, .14, at + .012, .025, "sine", false, .008, 650);
      return;
    }
    const table: Record<
      Exclude<SoundEffect, "victory" | "defeat" | "melee" | "arrow">,
      number[]
    > = {
      select: [420],
      order: [330, 440],
      error: [130, 100],
      build: [220, 330, 440],
      complete: [523, 659, 784],
      recruit: [392, 523],
      capture: [330, 440, 660],
      ability: [165, 330, 660],
      hit: [80],
      click: [560],
      upgrade: [294, 440, 587],
      research: [330, 494, 660],
      repair: [262, 330],
      resource: [440, 554],
      destroy: [147, 98],
      alert: [392, 294, 392],
    };
    const priority = kind === "error" || kind === "alert" ? 2 : kind === "complete" ? 1 : 0;
    if (!this.reserveEffects(table[kind].length, priority)) return;
    for (const [i, f] of table[kind].entries())
      this.note(
        f,
        kind === "hit" ? 0.08 : 0.22,
        at + i * 0.085,
        0.14,
        kind === "hit" || kind === "destroy" ? "triangle" : "sine",
        false,
        .025,
        undefined,
        priority,
      );
  }
}
