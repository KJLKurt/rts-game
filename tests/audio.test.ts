import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AudioDirector,
  type AudioState,
  type SoundEffect,
} from "../src/platform/audio";

// Reconstructed regression suite: check public behavior and observable WebAudio
// routing without reaching into the director's private voice/cache collections.
const durations: Record<AudioState, number> = {
  menu: 40,
  exploration: 80,
  tension: 40,
  combat: 80,
  victory: 7.5,
  defeat: 10,
};
const states = Object.keys(durations) as AudioState[];
const manifest = Object.fromEntries(
  states.map((state) => [
    state,
    {
      src: `assets/audio/${state}.ogg`,
      fallback: `assets/audio/${state}.mp3`,
      duration: durations[state],
      loopStart: 0,
      loopEnd: durations[state],
      volume: 0.7,
    },
  ]),
);
type Decoded = { duration: number; state: AudioState; codec: string };

class FakeParam {
  value = 1;
  setValueAtTime = vi.fn((value: number, _at: number) => {
    this.value = value;
    return this;
  });
  setTargetAtTime = vi.fn((value: number, _at: number, _constant: number) => {
    this.value = value;
    return this;
  });
  linearRampToValueAtTime = vi.fn((value: number, _at: number) => {
    this.value = value;
    return this;
  });
  exponentialRampToValueAtTime = vi.fn((value: number, _at: number) => {
    this.value = value;
    return this;
  });
  cancelScheduledValues = vi.fn((_at: number) => this);
  cancelAndHoldAtTime = vi.fn((_at: number) => this);
}
class FakeNode {
  connections: unknown[] = [];
  connect = vi.fn((destination: unknown) => {
    this.connections.push(destination);
    return destination;
  });
  disconnect = vi.fn(() => {
    this.connections.length = 0;
  });
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeVoice extends FakeNode {
  onended: (() => void) | null = null;
  ended = false;
  startedAt: number | null = null;
  stoppedAt = Infinity;
  start = vi.fn((at = 0) => {
    this.startedAt = at;
  });
  stop = vi.fn((at = 0) => {
    this.stoppedAt = at;
  });
  finish() {
    if (this.ended) return;
    this.ended = true;
    this.onended?.();
  }
}
class FakeSource extends FakeVoice {
  buffer: Decoded | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  playbackRate = new FakeParam();
}
class FakeOscillator extends FakeVoice {
  frequency = new FakeParam();
  detune = new FakeParam();
  type: OscillatorType = "sine";
}
class FakeContext {
  static instances: FakeContext[] = [];
  static decoder: (bytes: ArrayBuffer) => Promise<Decoded>;
  currentTime = 0;
  state = "running";
  destination = new FakeNode();
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  oscillators: FakeOscillator[] = [];
  resume = vi.fn(async () => {
    this.state = "running";
  });
  decodeAudioData = vi.fn((bytes: ArrayBuffer) => FakeContext.decoder(bytes));
  constructor() {
    FakeContext.instances.push(this);
  }
  createGain() {
    const node = new FakeGain();
    this.gains.push(node);
    return node;
  }
  createBufferSource() {
    const node = new FakeSource();
    this.sources.push(node);
    return node;
  }
  createOscillator() {
    const node = new FakeOscillator();
    this.oscillators.push(node);
    return node;
  }
  finishElapsed() {
    for (const voice of [...this.sources, ...this.oscillators]) {
      const naturalEnd =
        voice instanceof FakeSource && !voice.loop && voice.startedAt !== null
          ? voice.startedAt + (voice.buffer?.duration ?? Infinity)
          : Infinity;
      if (Math.min(voice.stoppedAt, naturalEnd) <= this.currentTime)
        voice.finish();
    }
  }
}
const directors: AudioDirector[] = [];
let fetchMock: ReturnType<typeof vi.fn>;
function director() {
  const audio = new AudioDirector();
  directors.push(audio);
  return audio;
}
function context() {
  const ctx = FakeContext.instances.at(-1);
  expect(ctx, "audio has been explicitly unlocked").toBeDefined();
  return ctx!;
}
function decode(bytes: ArrayBuffer): Decoded {
  const path = new TextDecoder().decode(bytes);
  const match = path.match(
    /\/(menu|exploration|tension|combat|victory|defeat)\.(ogg|mp3)$/,
  );
  if (!match) throw new Error(`Unexpected audio asset: ${path}`);
  const state = match[1] as AudioState;
  return { duration: durations[state], state, codec: match[2] };
}
function requestedPaths() {
  return fetchMock.mock.calls.map(([url]) => String(url));
}
function sourcesFor(state: AudioState) {
  return context().sources.filter((source) => source.buffer?.state === state);
}
function activeSources() {
  return context().sources.filter(
    (source) => !source.ended && source.stoppedAt > context().currentTime,
  );
}
function signalPath(node: FakeNode): FakeNode[] {
  const path: FakeNode[] = [],
    seen = new Set<FakeNode>();
  while (node.connections[0] instanceof FakeNode) {
    node = node.connections[0];
    if (seen.has(node)) throw new Error("Cycle in audio routing");
    seen.add(node);
    path.push(node);
  }
  return path;
}
function masterBus() {
  return context().gains.find((gain) =>
    gain.connections.includes(context().destination),
  )!;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function settle() {
  // Fetch, JSON, arrayBuffer, codec decoding and transitions each yield promises.
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
async function pulse(at: number, milliseconds = 250) {
  context().currentTime = at;
  context().finishElapsed();
  await vi.advanceTimersByTimeAsync(milliseconds);
  await settle();
  context().finishElapsed();
}
async function started(state: AudioState = "exploration") {
  const audio = director();
  audio.start(state);
  audio.unlock();
  await settle();
  return audio;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("BASE_URL", "/rts-game/");
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("AudioContext", FakeContext);
  FakeContext.instances = [];
  FakeContext.decoder = async (bytes) => decode(bytes);
  fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => manifest,
    arrayBuffer: async () => new TextEncoder().encode(String(url)).buffer,
  }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  for (const audio of directors.splice(0)) audio.stop();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("gesture-gated audio lifecycle", () => {
  it("arms the latest state without creating audio, fetching or scheduling", async () => {
    const audio = director();
    audio.setMaster(0.4);
    audio.setVolumes(0.2, 0.3);
    audio.start("menu");
    audio.setState("exploration");
    audio.setCombat(0.3);
    audio.play("click");
    await settle();
    expect(FakeContext.instances).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    audio.unlock();
    await settle();
    expect(FakeContext.instances).toHaveLength(1);
    expect(context().resume).toHaveBeenCalled();
    expect(sourcesFor(audio.getState())).toHaveLength(1);
  });
  it("allows unlock before start without starting music", async () => {
    const audio = director();
    audio.unlock();
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(context().sources).toHaveLength(0);
    expect(context().oscillators).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    audio.start("tension");
    await settle();
    expect(sourcesFor("tension")).toHaveLength(1);
  });
  it("does not restart a track on repeated unlock or repeated start", async () => {
    const audio = await started("menu");
    audio.unlock();
    audio.unlock();
    audio.start("menu");
    await settle();
    expect(FakeContext.instances).toHaveLength(1);
    expect(sourcesFor("menu")).toHaveLength(1);
  });
  it("can cancel an armed start before the first gesture", async () => {
    const audio = director();
    audio.start("combat");
    audio.stop();
    audio.setState("victory");
    audio.unlock();
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(context().sources).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("stops sources and the scheduler, stays stopped on state changes, and can restart", async () => {
    const audio = await started(),
      source = sourcesFor("exploration")[0];
    audio.stop();
    await pulse(5);
    expect(source.stop).toHaveBeenCalled();
    expect(source.disconnect).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    const count = context().sources.length;
    audio.setState("combat");
    audio.setCombat(1);
    await pulse(20);
    expect(context().sources).toHaveLength(count);
    audio.start("exploration");
    await settle();
    expect(sourcesFor("exploration")).toHaveLength(2);
    expect(activeSources()).toHaveLength(1);
  });
});

describe("independent volume buses", () => {
  it.each([false, true])(
    "applies saved volumes on first unlock with mute=%s",
    async (muted) => {
      const audio = director();
      audio.setMaster(0.4, muted);
      audio.setVolumes(0.23, 0.67);
      audio.start();
      audio.unlock();
      await settle();
      audio.play("click");
      expect(masterBus().gain.value).toBe(muted ? 0 : 0.4);
      const musicPath = signalPath(context().sources[0]),
        effectPath = signalPath(context().oscillators[0]);
      expect(musicPath).toContain(masterBus());
      expect(effectPath).toContain(masterBus());
      expect(
        musicPath.some(
          (node) => node instanceof FakeGain && node.gain.value === 0.23,
        ),
      ).toBe(true);
      expect(
        effectPath.some(
          (node) => node instanceof FakeGain && node.gain.value === 0.67,
        ),
      ).toBe(true);
    },
  );
  it("mute controls the shared master and restores its chosen level", async () => {
    const audio = await started();
    audio.setMaster(0.7, true);
    expect(masterBus().gain.value).toBe(0);
    audio.setMaster(0.7, false);
    expect(masterBus().gain.value).toBe(0.7);
    expect(sourcesFor("exploration")).toHaveLength(1);
  });
  it("clamps damaged values before and after unlocking", () => {
    const audio = director();
    audio.setMaster(NaN);
    audio.setVolumes(NaN, Infinity);
    audio.unlock();
    expect(masterBus().gain.value).toBe(0.85);
    expect(context().gains.map((node) => node.gain.value)).toContain(0.32);
    expect(context().gains.map((node) => node.gain.value)).toContain(0.65);
    audio.setMaster(99);
    expect(masterBus().gain.value).toBe(1);
    audio.setMaster(-5);
    expect(masterBus().gain.value).toBe(0);
    audio.setVolumes(-5, 99);
    expect(
      context().gains.every((node) => Number.isFinite(node.gain.value)),
    ).toBe(true);
  });
  it("changes music and effects separately without bypassing master", async () => {
    const audio = await started();
    audio.play("click");
    const musicPath = signalPath(context().sources[0]),
      effectPath = signalPath(context().oscillators[0]);
    const musicBus = musicPath.find(
      (node) => node instanceof FakeGain && node.gain.value === 0.32,
    ) as FakeGain;
    const effectBus = effectPath.find(
      (node) => node instanceof FakeGain && node.gain.value === 0.65,
    ) as FakeGain;
    expect(musicBus).toBeDefined();
    expect(effectBus).toBeDefined();
    expect(musicBus).not.toBe(effectBus);
    expect(effectPath).not.toContain(musicBus);
    audio.setVolumes(0, 0.9);
    expect(musicBus.gain.value).toBe(0);
    expect(effectBus.gain.value).toBe(0.9);
    expect(masterBus().gain.value).toBe(0.85);
    audio.setVolumes(0.8, 0);
    expect(musicBus.gain.value).toBe(0.8);
    expect(effectBus.gain.value).toBe(0);
  });
});

describe("state transitions and battle hysteresis", () => {
  it("defaults to exploration and accepts the legacy peace alias", async () => {
    const audio = await started();
    expect(audio.getState()).toBe("exploration");
    audio.setState("peace");
    await settle();
    expect(audio.getState()).toBe("exploration");
    expect(sourcesFor("exploration")).toHaveLength(1);
  });
  it("uses tension and combat thresholds and holds combat through brief lulls", async () => {
    const audio = await started();
    audio.setCombat(0.039);
    expect(audio.getState()).toBe("exploration");
    audio.setCombat(0.04);
    expect(audio.getState()).toBe("tension");
    audio.setCombat(0.219);
    expect(audio.getState()).toBe("tension");
    audio.setCombat(0.22);
    expect(audio.getState()).toBe("combat");
    await pulse(9.9);
    audio.setCombat(0);
    expect(audio.getState()).toBe("combat");
    await pulse(10.1);
    audio.setCombat(0);
    expect(audio.getState()).toBe("tension");
    await pulse(14.1);
    audio.setCombat(0);
    expect(audio.getState()).toBe("exploration");
  });
  it("refreshes the hold from the most recent combat and uses audio time", async () => {
    const audio = await started();
    audio.setCombat(1);
    await vi.advanceTimersByTimeAsync(60_000);
    audio.setCombat(0);
    expect(audio.getState()).toBe("combat");
    await pulse(8);
    audio.setCombat(0.5);
    await pulse(17.9);
    audio.setCombat(0);
    expect(audio.getState()).toBe("combat");
    await pulse(18.1);
    audio.setCombat(0);
    expect(audio.getState()).toBe("tension");
    await pulse(22.1);
    audio.setCombat(0);
    expect(audio.getState()).toBe("exploration");
  });
  it.each(["menu", "victory", "defeat"] as const)(
    "keeps %s independent of combat pressure",
    async (state) => {
      const audio = await started(state);
      audio.setCombat(1);
      await pulse(30);
      audio.setCombat(0);
      expect(audio.getState()).toBe(state);
      expect(sourcesFor("combat")).toHaveLength(0);
    },
  );
  it.each(["victory", "defeat"] as const)(
    "plays the %s coda once, including legacy play calls",
    async (state) => {
      const audio = await started();
      audio.play(state);
      await settle();
      expect(audio.getState()).toBe(state);
      expect(sourcesFor(state)).toHaveLength(1);
      expect(sourcesFor(state)[0].loop).toBe(false);
      await pulse(30);
      audio.setState(state);
      audio.play(state);
      await settle();
      expect(sourcesFor(state)).toHaveLength(1);
      expect(sourcesFor(state)[0].disconnect).toHaveBeenCalled();
      audio.stop();
      audio.start("exploration");
      await settle();
      audio.setState(state);
      await settle();
      expect(sourcesFor(state)).toHaveLength(2);
    },
  );
});

describe("lazy, bounded soundtrack loading", () => {
  it("loads only the selected state from the repository base and prefers Ogg", async () => {
    await started("tension");
    expect(requestedPaths()).toEqual([
      "/rts-game/assets/audio/manifest.json",
      "/rts-game/assets/audio/tension.ogg",
    ]);
    expect(context().decodeAudioData).toHaveBeenCalledOnce();
    expect(sourcesFor("tension")[0]).toMatchObject({
      loop: true,
      loopStart: 0,
      loopEnd: 40,
    });
  });
  it("uses MP3 when the preferred Ogg codec cannot decode", async () => {
    FakeContext.decoder = async (bytes) => {
      const buffer = decode(bytes);
      if (buffer.codec === "ogg") throw new Error("Unsupported Ogg codec");
      return buffer;
    };
    await started("combat");
    expect(requestedPaths()).toEqual([
      "/rts-game/assets/audio/manifest.json",
      "/rts-game/assets/audio/combat.ogg",
      "/rts-game/assets/audio/combat.mp3",
    ]);
    expect(sourcesFor("combat")[0].buffer?.codec).toBe("mp3");
  });
  it("uses MP3 when the Ogg asset is missing", async () => {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: !url.endsWith(".ogg"),
      json: async () => manifest,
      arrayBuffer: async () => new TextEncoder().encode(url).buffer,
    }));
    await started("menu");
    expect(sourcesFor("menu")[0].buffer?.codec).toBe("mp3");
    expect(context().decodeAudioData).toHaveBeenCalledOnce();
  });
  it("keeps a routed procedural score when both codecs fail", async () => {
    FakeContext.decoder = async () => {
      throw new Error("No supported codec");
    };
    const audio = await started();
    await pulse(0.1);
    expect(context().sources).toHaveLength(0);
    expect(requestedPaths()).toContain(
      "/rts-game/assets/audio/exploration.mp3",
    );
    expect(context().oscillators.length).toBeGreaterThan(0);
    const path = signalPath(context().oscillators[0]);
    expect(path).toContain(masterBus());
    const musicBus = path.find(
      (node) => node instanceof FakeGain && node.gain.value === 0.32,
    ) as FakeGain;
    expect(musicBus).toBeDefined();
    audio.setVolumes(0, 0.65);
    expect(musicBus.gain.value).toBe(0);
  });
  it("keeps offline procedural audio when the manifest is unavailable", async () => {
    fetchMock.mockRejectedValue(new Error("Offline"));
    await started("tension");
    await pulse(0.1);
    expect(context().sources).toHaveLength(0);
    expect(context().oscillators.length).toBeGreaterThan(0);
    expect(requestedPaths()).toEqual(["/rts-game/assets/audio/manifest.json"]);
  });
  it("does not let an old decode replace the latest requested state", async () => {
    const pending = deferred<Decoded>();
    FakeContext.decoder = async (bytes) => {
      const buffer = decode(bytes);
      return buffer.state === "exploration" ? pending.promise : buffer;
    };
    const audio = await started();
    expect(context().decodeAudioData).toHaveBeenCalledOnce();
    audio.setState("combat");
    await settle();
    expect(sourcesFor("combat")).toHaveLength(1);
    pending.resolve({ state: "exploration", duration: 80, codec: "ogg" });
    await settle();
    expect(audio.getState()).toBe("combat");
    expect(sourcesFor("exploration")).toHaveLength(0);
  });
  it("cannot resurrect a stopped soundtrack when a decode finishes", async () => {
    const pending = deferred<Decoded>();
    FakeContext.decoder = () => pending.promise;
    const audio = await started();
    audio.stop();
    pending.resolve({ state: "exploration", duration: 80, codec: "ogg" });
    await settle();
    await pulse(10);
    expect(context().sources).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps at most two sources during rapid crossfades and disconnects retired nodes", async () => {
    const audio = await started("menu");
    for (const state of [
      "exploration",
      "tension",
      "combat",
      "exploration",
      "victory",
    ] as const) {
      audio.setState(state);
      await settle();
      expect(activeSources().length).toBeLessThanOrEqual(2);
    }
    await pulse(5);
    expect(activeSources()).toHaveLength(1);
    for (const source of context().sources.slice(0, -1)) {
      expect(source.stop).toHaveBeenCalled();
      expect(source.disconnect).toHaveBeenCalled();
    }
  });
  it("reuses decoded tracks and evicts old entries from a three-buffer cache", async () => {
    const audio = await started("menu");
    for (const state of ["exploration", "menu"] as const) {
      audio.setState(state);
      await settle();
    }
    expect(
      requestedPaths().filter((path) => path.endsWith("menu.ogg")),
    ).toHaveLength(1);
    for (const state of ["tension", "combat"] as const) {
      audio.setState(state);
      await settle();
    }
    expect(context().decodeAudioData).toHaveBeenCalledTimes(4);
    // Four distinct cues cannot all remain cached: whichever one the eviction
    // policy chose must be decoded again when every previous cue is revisited.
    for (const state of ["menu", "exploration", "tension", "combat"] as const) {
      audio.setState(state);
      await settle();
    }
    expect(context().decodeAudioData.mock.calls.length).toBeGreaterThan(4);
    expect(
      requestedPaths().filter((path) => path.endsWith("manifest.json")),
    ).toHaveLength(1);
  });
});

describe("bounded effects and procedural voices", () => {
  it("supports every game effect through the effects bus", () => {
    const audio = director();
    audio.unlock();
    const effects: SoundEffect[] = [
      "select",
      "order",
      "error",
      "build",
      "recruit",
      "capture",
      "ability",
      "hit",
      "melee",
      "arrow",
      "complete",
      "click",
      "upgrade",
      "research",
      "repair",
      "resource",
      "destroy",
      "alert",
    ];
    for (const effect of effects) {
      context().currentTime += 1;
      context().finishElapsed();
      const count = context().oscillators.length;
      audio.play(effect);
      expect(context().oscillators.length, effect).toBeGreaterThan(count);
      const path = signalPath(context().oscillators.at(-1)!);
      expect(path).toContain(masterBus());
      expect(
        path.some(
          (node) => node instanceof FakeGain && node.gain.value === 0.65,
        ),
        effect,
      ).toBe(true);
    }
  });
  it.each([
    ["hit", 0.09],
    ["select", 0.06],
    ["click", 0.06],
    ["order", 0.18],
  ] as const)("rate limits %s for %s seconds", (effect, cooldown) => {
    const audio = director();
    audio.unlock();
    audio.play(effect);
    const count = context().oscillators.length;
    expect(count).toBeGreaterThan(0);
    context().currentTime = cooldown - 0.001;
    audio.play(effect);
    expect(context().oscillators).toHaveLength(count);
    context().currentTime = cooldown + 0.001;
    audio.play(effect);
    expect(context().oscillators.length).toBeGreaterThan(count);
  });
  it("limits effect voices and prioritizes error and alert feedback when full", () => {
    const audio = director();
    audio.unlock();
    for (const effect of [
      "build",
      "capture",
      "ability",
      "recruit",
      "upgrade",
      "research",
      "repair",
      "resource",
      "destroy",
    ] as const)
      audio.play(effect);
    const live = () =>
      context().oscillators.filter(
        (voice) => !voice.ended && voice.stoppedAt > context().currentTime,
      );
    expect(live().length).toBeGreaterThan(0);
    expect(live().length).toBeLessThanOrEqual(12);
    for (const effect of ["error", "alert", "complete"] as const) {
      const count = context().oscillators.length;
      audio.play(effect);
      expect(context().oscillators.length).toBeGreaterThan(count);
      expect(live().length).toBeLessThanOrEqual(12);
    }
  });
  it("uses distinct short metal partials, bow sweeps and a completion cadence", () => {
    const audio = director();
    audio.unlock();
    audio.play("melee");
    const metal = [...context().oscillators];
    expect(metal.map(n => n.frequency.value)).toEqual([145, 1260, 1817, 2943]);
    expect(metal.every(n => n.type === "sine" && n.stoppedAt <= .15)).toBe(true);
    expect(metal.every(n => n.frequency.exponentialRampToValueAtTime.mock.calls.length === 0)).toBe(true);
    context().currentTime = 1;
    context().finishElapsed();
    audio.play("arrow");
    const arrow = context().oscillators.slice(metal.length);
    expect(arrow.map(n => n.type)).toEqual(["triangle", "sine"]);
    expect(arrow.map(n => n.frequency.setValueAtTime.mock.calls[0][0])).toEqual([960, 2400]);
    expect(arrow.map(n => n.frequency.exponentialRampToValueAtTime.mock.calls[0][0])).toEqual([220, 650]);
    context().currentTime = 2;
    context().finishElapsed();
    audio.play("complete");
    expect(context().oscillators.slice(-3).map(n => n.frequency.value)).toEqual([523, 659, 784]);
    expect(context().oscillators.slice(-3).map(n => n.startedAt)).toEqual([2, 2.085, 2.17]);
  });
  it("shares a combat cooldown so release and same-tick damage do not stack", () => {
    const audio = director();
    audio.unlock();
    audio.play("arrow");
    expect(context().oscillators).toHaveLength(2);
    audio.play("hit");
    audio.play("melee");
    expect(context().oscillators).toHaveLength(2);
    context().currentTime = .091;
    audio.play("melee");
    expect(context().oscillators).toHaveLength(6);
    audio.play("complete");
    expect(context().oscillators).toHaveLength(9);
    audio.play("complete");
    expect(context().oscillators).toHaveLength(9);
  });
  it("drops whole combat cues at capacity and never lets completion cut warning voices", () => {
    const audio = director();
    audio.unlock();
    audio.play("alert");
    const warnings = [...context().oscillators];
    const originalStops = warnings.map(n => n.stoppedAt);
    audio.play("build");
    audio.play("capture");
    audio.play("recruit");
    expect(context().oscillators).toHaveLength(11);
    audio.play("melee");
    expect(context().oscillators).toHaveLength(11);
    audio.play("complete");
    expect(context().oscillators).toHaveLength(14);
    expect(warnings.map(n => n.stoppedAt)).toEqual(originalStops);
    expect(context().oscillators.filter(n => n.stoppedAt > 0)).toHaveLength(12);
  });
  it.each(["melee", "arrow", "complete"] as const)("keeps %s gesture-gated, bounded, and controlled by master/mute/effects", (kind) => {
    const audio = director();
    audio.play(kind);
    expect(FakeContext.instances).toHaveLength(0);
    audio.setMaster(.4, true);
    audio.setVolumes(.3, .2);
    audio.unlock();
    audio.play(kind);
    const path = signalPath(context().oscillators[0]);
    expect(path).toContain(masterBus());
    expect(masterBus().gain.value).toBe(0);
    const effects = path.find(n => n instanceof FakeGain && n.gain.value === .2) as FakeGain;
    expect(effects).toBeDefined();
    audio.setMaster(.4, false);
    expect(masterBus().gain.value).toBe(.4);
    audio.setVolumes(.3, 0);
    expect(effects.gain.value).toBe(0);
    for (let i = 1; i <= 100; i++) {
      context().currentTime = i * .2;
      context().finishElapsed();
      audio.play(kind);
      expect(context().oscillators.filter(n => !n.ended && n.stoppedAt > context().currentTime).length).toBeLessThanOrEqual(12);
    }
    context().currentTime = 30;
    context().finishElapsed();
    expect(context().oscillators.every(n => n.ended && n.disconnect.mock.calls.length === 1)).toBe(true);
  });
  it("disconnects finished effects and their individual envelopes", () => {
    const audio = director();
    audio.unlock();
    audio.play("build");
    const nodes = context().oscillators.map((voice) => ({
      voice,
      envelope: voice.connections[0] as FakeGain,
    }));
    expect(nodes.length).toBeGreaterThan(0);
    context().currentTime = 2;
    context().finishElapsed();
    for (const { voice, envelope } of nodes) {
      expect(voice.disconnect).toHaveBeenCalled();
      expect(envelope.disconnect).toHaveBeenCalled();
    }
  });
  it("caps bursty procedural music at 32 voices without consuming the effects budget", async () => {
    fetchMock.mockRejectedValue(new Error("Offline"));
    const audio = await started("combat");
    for (let i = 0; i < 12; i++) {
      audio.setState(i % 2 ? "combat" : "exploration");
      await settle();
      // Resetting the phrase repeatedly while audio time stands still produces
      // overlapping notes; fake wall-clock ticks alone must not free voices.
      await pulse(0, 120);
      expect(context().oscillators.length).toBeLessThanOrEqual(32);
    }
    expect(context().oscillators).toHaveLength(32);
    for (const effect of [
      "build",
      "capture",
      "ability",
      "upgrade",
      "research",
    ] as const)
      audio.play(effect);
    expect(context().oscillators).toHaveLength(44);
    const effectPath = signalPath(context().oscillators.at(-1)!);
    expect(
      effectPath.some(
        (node) => node instanceof FakeGain && node.gain.value === 0.65,
      ),
    ).toBe(true);
  });
  it.each(["victory", "defeat"] as const)(
    "ends a procedural %s coda and does not replay it",
    async (state) => {
      fetchMock.mockRejectedValue(new Error("Offline"));
      const audio = await started(state);
      for (let at = 0; at < 15; at += 0.25) await pulse(at, 250);
      const count = context().oscillators.length;
      expect(count).toBeGreaterThan(0);
      audio.setState(state);
      audio.play(state);
      await pulse(30);
      expect(context().oscillators).toHaveLength(count);
      expect(context().oscillators.every((voice) => voice.ended)).toBe(true);
    },
  );
  it("bounds procedural voices during long playback and clears them on stop", async () => {
    fetchMock.mockRejectedValue(new Error("Offline"));
    const audio = await started("combat");
    for (let at = 0.25; at < 20; at += 0.25) {
      await pulse(at, 250);
      expect(
        context().oscillators.filter(
          (voice) => !voice.ended && voice.stoppedAt > at,
        ).length,
      ).toBeLessThanOrEqual(32);
    }
    expect(context().oscillators.length).toBeGreaterThan(32);
    audio.stop();
    await pulse(30);
    expect(
      context().oscillators.every(
        (voice) => voice.disconnect.mock.calls.length > 0,
      ),
    ).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("packaged offline soundtrack", () => {
  it.each(states)(
    "ships the %s cue with both codecs and the intended duration",
    (state) => {
      const packaged = JSON.parse(
        readFileSync(resolve("public/assets/audio/manifest.json"), "utf8"),
      );
      expect(Object.keys(packaged).sort()).toEqual([...states].sort());
      const entry = packaged[state];
      expect(entry.duration).toBe(durations[state]);
      expect(entry.src).toBe(`assets/audio/${state}.ogg`);
      expect(entry.fallback).toBe(`assets/audio/${state}.mp3`);
      expect(entry.volume).toBeGreaterThan(0);
      expect(entry.volume).toBeLessThanOrEqual(1);
      expect(entry.loop).toBe(state !== "victory" && state !== "defeat");
      if (entry.loop) {
        expect(entry.loopStart).toBe(0);
        expect(entry.loopEnd).toBe(entry.duration);
      }
      const ogg = readFileSync(resolve("public", entry.src));
      const mp3 = readFileSync(resolve("public", entry.fallback));
      expect(ogg.length).toBeGreaterThan(1000);
      expect(mp3.length).toBeGreaterThan(1000);
      expect(ogg.subarray(0, 4).toString("ascii")).toBe("OggS");
      const hasMP3Header =
        mp3.subarray(0, 3).toString("ascii") === "ID3" ||
        (mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0);
      expect(hasMP3Header).toBe(true);
    },
  );
});
