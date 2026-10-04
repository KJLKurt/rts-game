/** Original generative score. No network, sampled copyrighted music, or timing in the simulation. */
export class AudioDirector {
  private masterVolume = 0.85;
  private muted = false;
  private lastMixSignature = "";
  private trackLoad: Promise<void> | null = null;
  private tracksReady = false;
  private trackGains: GainNode[] = [];
  private trackVolumes: number[] = [];
  private trackSources: AudioBufferSourceNode[] = [];
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private next = 0;
  private beat = 0;
  private active = false;
  private timer = 0;
  private combat = 0;
  private musicVolume = 0.32;
  private sfxVolume = 0.65;
  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.master.gain.value = this.muted ? 0 : this.masterVolume;
      this.musicGain = this.context.createGain();
      this.musicGain.connect(this.master);
      this.musicGain.gain.value = this.musicVolume * 0.18;
    }
    void this.context.resume();
  }
  setMaster(volume: number, muted = false) {
    this.masterVolume = Number.isFinite(volume)
      ? Math.max(0, Math.min(1, volume))
      : 0.85;
    this.muted = muted;
    if (this.master)
      this.master.gain.setTargetAtTime(
        muted ? 0 : this.masterVolume,
        this.context!.currentTime,
        0.05,
      );
  }
  setVolumes(music: number, sfx: number) {
    this.musicVolume = Number.isFinite(music)
      ? Math.max(0, Math.min(1, music))
      : 0.32;
    this.sfxVolume = Number.isFinite(sfx)
      ? Math.max(0, Math.min(1, sfx))
      : 0.65;
    if (this.musicGain)
      this.musicGain.gain.setTargetAtTime(
        this.tracksReady ? 0 : this.musicVolume * 0.18,
        this.context!.currentTime,
        0.15,
      );
    this.mixTracks();
  }
  start() {
    this.unlock();
    this.active = true;
    if (!this.trackLoad) this.trackLoad = this.loadTracks();
    this.mixTracks();
    if (!this.timer)
      this.timer = window.setInterval(() => this.schedule(), 120);
  }
  stop() {
    this.active = false;
    this.mixTracks();
  }
  setCombat(value: number) {
    this.combat = value;
    this.mixTracks();
  }
  private async loadTracks() {
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}assets/audio/manifest.json`,
      );
      if (!response.ok) throw Error("Music manifest unavailable");
      const manifest = await response.json();
      const entries = [manifest.exploration, manifest.combat];
      const buffers = await Promise.all(
        entries.map(async (entry) => {
          for (const src of [entry.src, entry.fallback].filter(Boolean)) {
            try {
              const r = await fetch(`${import.meta.env.BASE_URL}${src}`);
              if (!r.ok) continue;
              return await this.context!.decodeAudioData(await r.arrayBuffer());
            } catch {}
          }
          throw Error("Music decoding unavailable");
        }),
      );
      const at = this.context!.currentTime + 0.05;
      for (let i = 0; i < buffers.length; i++) {
        const source = this.context!.createBufferSource(),
          gain = this.context!.createGain();
        source.buffer = buffers[i];
        source.loop = true;
        source.loopStart = entries[i].loopStart ?? 0;
        source.loopEnd = entries[i].loopEnd ?? buffers[i].duration;
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(this.master!);
        source.start(at);
        this.trackSources.push(source);
        this.trackGains.push(gain);
        this.trackVolumes.push(entries[i].volume ?? 0.7);
      }
      this.tracksReady = true;
      this.musicGain!.gain.setTargetAtTime(0, at, 1);
      this.mixTracks();
    } catch {
      /* The original generative score remains a fully offline fallback. */
    }
  }
  private mixTracks() {
    if (!this.context || !this.tracksReady) return;
    const blend = Math.min(1, Math.max(0, this.combat * 2.5));
    const signature = `${this.active}:${Math.round(blend * 20)}:${this.musicVolume}`;
    if (signature === this.lastMixSignature) return;
    this.lastMixSignature = signature;
    const values = [Math.sqrt(1 - blend), Math.sqrt(blend)];
    this.trackGains.forEach((g, i) =>
      g.gain.setTargetAtTime(
        this.active ? values[i] * this.musicVolume * this.trackVolumes[i] : 0,
        this.context!.currentTime,
        0.65,
      ),
    );
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
    const osc = this.context.createOscillator(),
      gain = this.context.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume),
      at + 0.035,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(music ? this.musicGain! : this.master);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }
  private schedule() {
    if (
      this.tracksReady ||
      !this.context ||
      !this.active ||
      this.context.state !== "running"
    )
      return;
    const ctx = this.context;
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.04;
    while (this.next < ctx.currentTime + 0.35) {
      const chord = [
        [146.83, 220, 293.66, 349.23],
        [130.81, 196, 261.63, 329.63],
        [174.61, 261.63, 349.23, 440],
        [110, 164.81, 220, 293.66],
      ][Math.floor(this.beat / 16) % 4];
      if (this.beat % 8 === 0) {
        for (const f of chord) this.note(f, 3.1, this.next, 0.13, "sine");
        this.note(chord[0] / 2, 2.3, this.next, 0.24, "triangle");
      }
      const order = [0, 2, 1, 3, 2, 1, 3, 2];
      this.note(
        chord[order[this.beat % 8]] * (this.beat % 4 === 0 ? 2 : 1),
        0.8,
        this.next,
        0.17,
        "sine",
      );
      if (this.combat > 0.1) {
        this.note(
          this.beat % 2 === 0 ? 58 : 87,
          0.12,
          this.next,
          0.13 + this.combat * 0.1,
          "triangle",
        );
        if (this.beat % 4 === 0)
          this.note(chord[0] / 2, 0.32, this.next, 0.16, "sawtooth");
      }
      this.beat++;
      this.next += this.combat > 0.2 ? 0.29 : 0.42;
    }
  }
  play(
    kind:
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
      | "click",
  ) {
    if (!this.context || this.context.state !== "running") return;
    const at = this.context.currentTime,
      v = this.sfxVolume * 0.14;
    const table: Record<string, number[]> = {
      select: [420],
      order: [330, 440],
      error: [130, 100],
      build: [220, 330, 440],
      recruit: [392, 523],
      capture: [330, 440, 660],
      ability: [165, 330, 660],
      hit: [80],
      victory: [262, 330, 392, 523, 659],
      defeat: [220, 196, 164],
      click: [560],
    };
    for (const [i, f] of table[kind].entries())
      this.note(
        f,
        kind === "hit" ? 0.08 : 0.2,
        at + i * 0.085,
        v,
        kind === "hit" ? "triangle" : "sine",
        false,
      );
  }
}
