/** Original, replaceable offline score. Audio never affects simulation timing. */
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
}
const STATES: AudioState[] = [
  "menu",
  "exploration",
  "tension",
  "combat",
  "victory",
  "defeat",
];
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
  private active = false;
  private timer = 0;
  private next = 0;
  private beat = 0;
  private combatUntil = 0;
  private tensionUntil = 0;
  private request = 0;
  private manifest: Promise<Partial<Record<AudioState, TrackEntry>>> | null =
    null;
  private buffers = new Map<AudioState, Promise<Track | null>>();
  private voices: MusicVoice[] = [];
  private notes: NoteVoice[] = [];
  private lastEffect = new Map<SoundEffect, number>();
  private hasTrack = false;

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
    this.master?.gain.setTargetAtTime(
      muted ? 0 : this.masterVolume,
      this.context!.currentTime,
      0.05,
    );
  }
  setVolumes(music: number, sfx: number) {
    this.musicVolume = limit(music, 0.32);
    this.sfxVolume = limit(sfx, 0.65);
    if (!this.context) return;
    this.musicGain!.gain.setTargetAtTime(
      this.musicVolume,
      this.context.currentTime,
      0.15,
    );
    this.effectsGain!.gain.setTargetAtTime(
      this.sfxVolume,
      this.context.currentTime,
      0.05,
    );
  }
  /** Arm music without creating/resuming an AudioContext; unlock only in a gesture. */
  start(state: AudioState | "peace" = "exploration") {
    if (!this.active) {
      this.active = true;
      this.hasTrack = false;
      this.combatUntil = this.tensionUntil = 0;
      this.state = state === "peace" ? "exploration" : state;
    } else this.setState(state);
    this.beginPlayback();
  }
  private beginPlayback() {
    if (!this.active || !this.context || this.timer) return;
    this.resetPhrase();
    this.updateFallback();
    void this.loadState();
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
    this.resetPhrase();
    if (!isGameplay(resolved)) this.combatUntil = this.tensionUntil = 0;
    if (this.active && this.context) void this.loadState();
  }
  getState(): AudioState {
    return this.state;
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
  private getManifest() {
    if (!this.manifest)
      this.manifest = (async () => {
        try {
          const response = await fetch(
            `${import.meta.env.BASE_URL}assets/audio/manifest.json`,
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
    return this.manifest;
  }
  private getTrack(state: AudioState) {
    let pending = this.buffers.get(state);
    if (!pending) {
      pending = (async () => {
        const entry = (await this.getManifest())[state];
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
      })();
      this.buffers.set(state, pending);
    }
    return pending;
  }
  private async loadState() {
    const request = ++this.request,
      state = this.state;
    const track = await this.getTrack(state);
    if (request !== this.request || !this.active || !this.context) return;
    // Keep no more than three cached cues. Loading is demand-driven on mobile.
    for (const key of this.buffers.keys()) {
      if (this.buffers.size <= 3) break;
      if (key !== state) this.buffers.delete(key);
    }
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
    source.onended = () => this.removeVoice(voice, false);
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
      this.active && !this.hasTrack ? 0.18 : 0,
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
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume),
      at + 0.025,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(music ? this.fallbackGain! : this.effectsGain!);
    const voice = { source: osc, gain, end: at + duration + 0.02, music };
    this.notes.push(voice);
    osc.onended = () => this.removeNote(voice);
    osc.start(at);
    osc.stop(voice.end);
  }
  private schedule() {
    if (
      !this.context ||
      !this.active ||
      this.context.state !== "running" ||
      this.hasTrack
    )
      return;
    const ctx = this.context,
      result = isResult(this.state);
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.04;
    while (this.next < ctx.currentTime + 0.35) {
      if (result && this.beat >= (this.state === "victory" ? 24 : 32)) return;
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
    const cooldown =
      kind === "hit"
        ? 0.09
        : kind === "select" || kind === "click"
          ? 0.06
          : 0.18;
    if (at - (this.lastEffect.get(kind) ?? -Infinity) < cooldown) return;
    this.lastEffect.set(kind, at);
    const table: Record<
      Exclude<SoundEffect, "victory" | "defeat">,
      number[]
    > = {
      select: [420],
      order: [330, 440],
      error: [130, 100],
      build: [220, 330, 440],
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
    if (kind === "error" || kind === "alert") {
      const effects = this.notes.filter(
        (voice) => !voice.music && voice.end > at,
      );
      while (effects.length + table[kind].length > 12)
        this.removeNote(effects.shift()!, true);
    }
    for (const [i, f] of table[kind].entries())
      this.note(
        f,
        kind === "hit" ? 0.08 : 0.22,
        at + i * 0.085,
        0.14,
        kind === "hit" || kind === "destroy" ? "triangle" : "sine",
        false,
      );
  }
}
