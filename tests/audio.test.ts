import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AudioDirector,
  type AudioState,
  type AudioTheme,
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
const mythicManifest = Object.fromEntries(
  states.map(state => [state, {
    ...manifest[state],
    src: `assets/audio/mythic/${state}.ogg`,
    fallback: `assets/audio/mythic/${state}.mp3`,
  }]),
);
const halloweenManifest = Object.fromEntries(
  states.map(state => [state, {
    ...manifest[state],
    src: `assets/audio/halloween/${state}.ogg`,
    fallback: `assets/audio/halloween/${state}.mp3`,
  }]),
);
const spaceManifest = Object.fromEntries(
  states.map(state => [state, {
    ...manifest[state],
    src: `assets/audio/space/${state}.ogg`,
    fallback: `assets/audio/space/${state}.mp3`,
  }]),
);
type Decoded = {
  duration: number;
  state: AudioState;
  theme: AudioTheme;
  codec: string;
};

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
  return {
    duration: durations[state], state, codec: match[2],
    theme: path.includes("/space/") ? "space" : path.includes("/halloween/") ? "halloween" : path.includes("/mythic/") ? "mythic" : "christmas",
  };
}
function requestedPaths() {
  return fetchMock.mock.calls.map(([url]) => String(url));
}
function sourcesFor(state: AudioState, theme?: AudioTheme) {
  return context().sources.filter((source) => source.buffer?.state === state &&
    (!theme || source.buffer.theme === theme));
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
// FakeParam.value eagerly reflects a target. Sample its automation separately
// so zero tests can detect exponential tails and uncancelled future targets.
function scheduledGainAt(param: FakeParam, initial: number, at: number) {
  type Event = { order: number; at: number; value: number; constant?: number; cancel?: boolean };
  const operations: Event[] = [
    ...param.setValueAtTime.mock.calls.map(([value, at], i) => ({
      value, at, order: param.setValueAtTime.mock.invocationCallOrder[i],
    })),
    ...param.setTargetAtTime.mock.calls.map(([value, at, constant], i) => ({
      value, at, constant, order: param.setTargetAtTime.mock.invocationCallOrder[i],
    })),
    ...param.cancelScheduledValues.mock.calls.map(([at], i) => ({
      value: 0, at, cancel: true, order: param.cancelScheduledValues.mock.invocationCallOrder[i],
    })),
  ];
  let events: Event[] = [];
  for (const operation of operations.sort((a, b) => a.order - b.order)) {
    if (operation.cancel) events = events.filter(event => event.at < operation.at);
    else events.push(operation);
  }
  let value = initial, previous = 0, target: Event | undefined;
  const advance = (time: number) => {
    if (target) value = target.value + (value - target.value) * Math.exp(-(time - previous) / target.constant!);
    previous = time;
  };
  for (const event of events.sort((a, b) => a.at - b.at || a.order - b.order)) {
    if (event.at > at) break;
    advance(event.at);
    if (event.constant !== undefined) target = event;
    else { value = event.value; target = undefined; }
  }
  advance(at);
  return value;
}
type VolumeControl = "master" | "music" | "effects" | "mute";
function volumeBus(control: VolumeControl) {
  const master = masterBus();
  const music = signalPath(context().sources[0])[1] as FakeGain;
  if (control === "music") return music;
  if (control === "effects") return context().gains.find(gain => gain !== music && gain.connections.includes(master))!;
  return master;
}
function setVolumeControl(audio: AudioDirector, control: VolumeControl, volume: number) {
  if (control === "master") audio.setMaster(volume);
  else if (control === "mute") audio.setMaster(0.73, volume === 0);
  else if (control === "music") audio.setVolumes(volume, 0.65);
  else audio.setVolumes(0.32, volume);
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
    json: async () => String(url).includes("/space/") ? spaceManifest : String(url).includes("/halloween/") ? halloweenManifest : String(url).includes("/mythic/") ? mythicManifest : manifest,
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
  it.each(["master", "music", "effects", "mute"] as const)(
    "makes %s zero exact despite an ongoing fade and queued positive automation",
    async control => {
      const audio = await started("menu"), bus = volumeBus(control);
      const initial = bus.gain.value;
      context().currentTime = 2;
      setVolumeControl(audio, control, 0.73);
      bus.gain.setTargetAtTime(0.91, 5, 0.05);
      context().currentTime = 2.1;
      setVolumeControl(audio, control, 0);
      for (const at of [2.1, 2.1001, 3.8, 6])
        expect(scheduledGainAt(bus.gain, initial, at), `${control} at ${at}`).toBe(0);
      expect(bus.gain.cancelScheduledValues).toHaveBeenLastCalledWith(2.1);
      expect(bus.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 2.1);
      expect(bus.gain.cancelScheduledValues.mock.invocationCallOrder.at(-1))
        .toBeLessThan(bus.gain.setValueAtTime.mock.invocationCallOrder.at(-1)!);
      expect(bus.gain.setTargetAtTime.mock.calls.every(([target]) => target > 0)).toBe(true);
    },
  );
  it.each(["master", "music", "effects", "mute"] as const)(
    "retains exact %s silence for future cues, theme changes and stop/start recovery",
    async control => {
      const audio = await started("menu"), bus = volumeBus(control);
      const initial = bus.gain.value;
      expect(context().oscillators).toHaveLength(0);
      context().currentTime = 1;
      setVolumeControl(audio, control, 0);
      await pulse(3.7);
      audio.play("build");
      expect(context().oscillators).toHaveLength(3);
      for (const oscillator of context().oscillators) {
        if (control !== "music") expect(signalPath(oscillator)).toContain(bus);
      }
      audio.setTheme("mythic");
      audio.setState("exploration");
      await settle();
      if (control !== "effects") expect(signalPath(context().sources.at(-1)!)).toContain(bus);
      expect(scheduledGainAt(bus.gain, initial, 3.7)).toBe(0);
      expect(activeSources().length).toBeLessThanOrEqual(2);
      audio.stop();
      await pulse(5);
      audio.start(audio.getState());
      audio.unlock();
      await settle();
      audio.play("complete");
      expect(scheduledGainAt(bus.gain, initial, 5)).toBe(0);
      expect(activeSources().length).toBeLessThanOrEqual(2);
      expect(FakeContext.instances).toHaveLength(1);
    },
  );
  it.each(["master", "music", "effects", "mute"] as const)(
    "restores %s from exact zero using its existing nonzero smoothing",
    async control => {
      const audio = await started("menu"), bus = volumeBus(control);
      const initial = bus.gain.value, smoothing = control === "music" ? 0.15 : 0.05;
      context().currentTime = 1;
      setVolumeControl(audio, control, 0);
      audio.stop();
      await pulse(3);
      setVolumeControl(audio, control, 0.73);
      audio.start(audio.getState());
      audio.unlock();
      await settle();
      expect(bus.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.73, 3, smoothing);
      expect(bus.gain.cancelScheduledValues).toHaveBeenCalledTimes(1);
      expect(bus.gain.setValueAtTime).toHaveBeenCalledTimes(1);
      expect(scheduledGainAt(bus.gain, initial, 3)).toBe(0);
      expect(scheduledGainAt(bus.gain, initial, 3 + smoothing))
        .toBeCloseTo(0.73 * (1 - Math.exp(-1)), 12);
      expect(scheduledGainAt(bus.gain, initial, 4)).toBeGreaterThan(0.7);
      audio.setTheme("mythic");
      await settle();
      expect(activeSources().length).toBeLessThanOrEqual(2);
      const voiceGain = context().sources.at(-1)!.connections[0] as FakeGain;
      expect(voiceGain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.7, 3.025, 0.45);
      expect(voiceGain.gain.cancelScheduledValues).not.toHaveBeenCalled();
    },
  );
  it("stores exact zero controls before unlock without creating a context or scheduling ramps", async () => {
    const audio = director();
    audio.setMaster(0.73, true);
    audio.setVolumes(0, 0);
    audio.start("menu");
    expect(FakeContext.instances).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    audio.unlock();
    await settle();
    for (const control of ["master", "music", "effects"] as const) {
      const gain = volumeBus(control).gain;
      expect(gain.value).toBe(0);
      expect(gain.setTargetAtTime).not.toHaveBeenCalled();
    }
    audio.setMaster(0.73, false);
    expect(masterBus().gain.setTargetAtTime).toHaveBeenLastCalledWith(0.73, 0, 0.05);
  });
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
    pending.resolve({ state: "exploration", duration: 80, codec: "ogg", theme: "christmas" });
    await settle();
    expect(audio.getState()).toBe("combat");
    expect(sourcesFor("exploration")).toHaveLength(0);
  });
  it("cannot resurrect a stopped soundtrack when a decode finishes", async () => {
    const pending = deferred<Decoded>();
    FakeContext.decoder = () => pending.promise;
    const audio = await started();
    audio.stop();
    pending.resolve({ state: "exploration", duration: 80, codec: "ogg", theme: "christmas" });
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

describe("theme-aware soundtrack routing", () => {
  it("arms only the latest theme and state without bypassing the first gesture", async () => {
    const audio = director();
    audio.start("menu");
    audio.setTheme("mythic");
    audio.setState("combat");
    audio.setTheme("christmas");
    audio.setTheme("mythic");
    await settle();
    expect(audio.getTheme()).toBe("mythic");
    expect(FakeContext.instances).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    audio.unlock();
    await settle();
    expect(requestedPaths()).toEqual([
      "/rts-game/assets/audio/mythic/manifest.json",
      "/rts-game/assets/audio/mythic/combat.ogg",
    ]);
    expect(sourcesFor("combat", "mythic")).toHaveLength(1);
  });
  it.each((["mythic", "halloween", "space"] as const).flatMap(theme => states.map(state => ({theme, state}))))("selects the $theme $state cue using the existing state contract", async ({theme, state}) => {
    const audio = director();
    audio.setTheme(theme);
    audio.start(state);
    audio.unlock();
    await settle();
    expect(requestedPaths()).toEqual([
      `/rts-game/assets/audio/${theme}/manifest.json`,
      `/rts-game/assets/audio/${theme}/${state}.ogg`,
    ]);
    expect(sourcesFor(state, theme)).toHaveLength(1);
    expect(sourcesFor(state, theme)[0].loop).toBe(state !== "victory" && state !== "defeat");
  });
  it("preserves combat and tension holds when changing banks", async () => {
    const audio = await started();
    audio.setCombat(1);
    await settle();
    await pulse(8);
    audio.setTheme("mythic");
    await settle();
    expect(audio.getState()).toBe("combat");
    expect(sourcesFor("combat", "mythic")).toHaveLength(1);
    await pulse(9.9);
    audio.setCombat(0);
    expect(audio.getState()).toBe("combat");
    await pulse(10.1);
    audio.setCombat(0);
    expect(audio.getState()).toBe("tension");
    audio.setTheme("christmas");
    await settle();
    await pulse(14.1);
    audio.setCombat(0);
    expect(audio.getState()).toBe("exploration");
  });
  it("keeps the context, mute, master, music and effects buses across banks", async () => {
    const audio = await started("menu");
    audio.setMaster(0.42, true);
    audio.setVolumes(0.19, 0.61);
    const originalMusicPath = signalPath(context().sources[0]);
    audio.setTheme("mythic");
    await settle();
    audio.play("click");
    const nextMusicPath = signalPath(context().sources.at(-1)!);
    expect(nextMusicPath.slice(1)).toEqual(originalMusicPath.slice(1));
    expect(FakeContext.instances).toHaveLength(1);
    expect(masterBus().gain.value).toBe(0);
    expect(nextMusicPath.some(node => node instanceof FakeGain && node.gain.value === 0.19)).toBe(true);
    expect(signalPath(context().oscillators.at(-1)!).some(node => node instanceof FakeGain && node.gain.value === 0.61)).toBe(true);
    audio.setMaster(0.42, false);
    expect(masterBus().gain.value).toBe(0.42);
    audio.setTheme("mythic");
    audio.unlock();
    await settle();
    expect(sourcesFor("menu", "mythic")).toHaveLength(1);
  });
  it("changes the selected bank while stopped without starting or fetching", async () => {
    const audio = await started("menu");
    audio.stop();
    audio.setTheme("mythic");
    await settle();
    expect(requestedPaths().some(path => path.includes("/mythic/"))).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    audio.start("exploration");
    await settle();
    expect(sourcesFor("exploration", "mythic")).toHaveLength(1);
  });
  it("ignores a late decode from the old theme even for the same state", async () => {
    const old = deferred<Decoded>();
    FakeContext.decoder = async bytes => {
      const buffer = decode(bytes);
      return buffer.theme === "christmas" ? old.promise : buffer;
    };
    const audio = await started("combat");
    audio.setTheme("mythic");
    await settle();
    expect(sourcesFor("combat", "mythic")).toHaveLength(1);
    old.resolve({ theme: "christmas", state: "combat", duration: 80, codec: "ogg" });
    await settle();
    expect(context().sources).toHaveLength(1);
    expect(audio.getTheme()).toBe("mythic");
    expect(audio.getState()).toBe("combat");
  });
  it("reuses an in-flight cue when switching away and back; redundant theme calls stay inert", async () => {
    const waiting = new Map<AudioTheme, ReturnType<typeof deferred<Decoded>>>();
    FakeContext.decoder = async bytes => {
      const buffer = decode(bytes), pending = deferred<Decoded>();
      waiting.set(buffer.theme, pending);
      return pending.promise;
    };
    const audio = await started("menu");
    audio.setTheme("mythic");
    await settle();
    audio.setTheme("christmas");
    audio.setTheme("christmas");
    await settle();
    expect(context().decodeAudioData).toHaveBeenCalledTimes(2);
    waiting.get("mythic")!.resolve({ theme: "mythic", state: "menu", duration: 40, codec: "ogg" });
    await settle();
    expect(context().sources).toHaveLength(0);
    waiting.get("christmas")!.resolve({ theme: "christmas", state: "menu", duration: 40, codec: "ogg" });
    await settle();
    expect(sourcesFor("menu", "christmas")).toHaveLength(1);
    audio.setTheme("christmas");
    await settle();
    expect(context().sources).toHaveLength(1);
  });
  it("shares a three-cue decoded cache across both banks", async () => {
    const audio = await started("menu");
    audio.setTheme("mythic");
    await settle();
    audio.setState("exploration");
    await settle();
    audio.setTheme("christmas");
    await settle();
    expect(context().decodeAudioData).toHaveBeenCalledTimes(4);
    // The oldest Christmas cue must be evicted even though its bank used only
    // two states; a separate per-theme cache would incorrectly keep it.
    audio.setState("menu");
    await settle();
    expect(context().decodeAudioData).toHaveBeenCalledTimes(5);
    expect(requestedPaths().filter(path => path === "/rts-game/assets/audio/menu.ogg")).toHaveLength(2);
    expect(requestedPaths().filter(path => path.endsWith("manifest.json"))).toHaveLength(2);
  });
  it("shares the same three-entry decoded budget across all four theme banks", async () => {
    const audio = await started("menu");
    audio.setTheme("mythic"); await settle();
    audio.setTheme("halloween"); await settle();
    expect(context().decodeAudioData).toHaveBeenCalledTimes(3);
    audio.setTheme("space"); await settle();
    expect(context().decodeAudioData).toHaveBeenCalledTimes(4);
    audio.setState("exploration"); await settle();
    expect(context().decodeAudioData).toHaveBeenCalledTimes(5);
    audio.setState("menu"); await settle();
    expect(context().decodeAudioData).toHaveBeenCalledTimes(5);
    audio.setTheme("christmas"); await settle();
    expect(context().decodeAudioData).toHaveBeenCalledTimes(6);
    expect(requestedPaths().filter(path => path === "/rts-game/assets/audio/menu.ogg")).toHaveLength(2);
    expect(requestedPaths().filter(path => path.endsWith("manifest.json"))).toHaveLength(4);
  });
  it("reserves all three pending slots and admits only the newest waiting request", async () => {
    const pending: { buffer: Decoded; resolve: (buffer: Decoded) => void }[] = [];
    let decoding = 0, maximum = 0;
    FakeContext.decoder = async bytes => {
      const buffer = decode(bytes), gate = deferred<Decoded>();
      pending.push({ buffer, resolve: gate.resolve });
      maximum = Math.max(maximum, ++decoding);
      try { return await gate.promise; }
      finally { decoding--; }
    };
    const audio = await started("menu");
    audio.setState("exploration");
    await settle();
    audio.setTheme("mythic");
    await settle();
    audio.setState("combat");
    audio.setTheme("christmas");
    audio.setState("victory");
    audio.setTheme("mythic");
    await settle();
    expect(pending).toHaveLength(3);
    expect(requestedPaths().some(path => /\/(combat|victory)\./.test(path))).toBe(false);
    pending[0].resolve(pending[0].buffer);
    await settle();
    expect(pending).toHaveLength(4);
    expect(pending[3].buffer).toMatchObject({ theme: "mythic", state: "victory" });
    expect(requestedPaths().some(path => path.includes("combat."))).toBe(false);
    pending[3].resolve(pending[3].buffer);
    await settle();
    expect(sourcesFor("victory", "mythic")).toHaveLength(1);
    for (const item of pending.slice(1, 3)) item.resolve(item.buffer);
    await settle();
    expect(maximum).toBe(3);
    expect(context().sources).toHaveLength(1);
  });
  it("does not admit a queued cue after stop releases an occupied decode slot", async () => {
    const pending: { buffer: Decoded; resolve: (buffer: Decoded) => void }[] = [];
    FakeContext.decoder = async bytes => {
      const gate = deferred<Decoded>();
      pending.push({ buffer: decode(bytes), resolve: gate.resolve });
      return gate.promise;
    };
    const audio = await started("menu");
    for (const state of ["exploration", "tension"] as const) {
      audio.setState(state);
      await settle();
    }
    audio.setTheme("mythic");
    await settle();
    audio.stop();
    for (const item of pending) item.resolve(item.buffer);
    await settle();
    expect(context().decodeAudioData).toHaveBeenCalledTimes(3);
    expect(requestedPaths().some(path => path.includes("/mythic/"))).toBe(false);
    expect(context().sources).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("caps all four banks together at two sources during repeated crossfades", async () => {
    const audio = await started("menu");
    for (const state of states) {
      audio.setState(state);
      await settle();
      for (const theme of ["mythic", "halloween", "space", "christmas", "halloween", "space"] as const) {
        audio.setTheme(theme);
        await settle();
        expect(activeSources().length).toBeLessThanOrEqual(2);
      }
    }
    await pulse(30);
    expect(activeSources()).toHaveLength(0);
    expect(context().sources.every(source => source.disconnect.mock.calls.length === 1)).toBe(true);
  });
  it.each(["mythic", "halloween", "space"] as const)("uses the %s alternate codec without requesting other banks", async theme => {
    FakeContext.decoder = async bytes => {
      const buffer = decode(bytes);
      if (buffer.codec === "ogg") throw Error("Unsupported codec");
      return buffer;
    };
    const audio = director();
    audio.setTheme(theme);
    audio.start("tension");
    audio.unlock();
    await settle();
    expect(sourcesFor("tension", theme)[0].buffer?.codec).toBe("mp3");
    expect(requestedPaths().every(path => path.includes(`/assets/audio/${theme}/`))).toBe(true);
  });
  it.each(["mythic", "halloween", "space"] as const)("uses the selected state for procedural fallback when the %s bank fails", async theme => {
    FakeContext.decoder = async bytes => {
      const buffer = decode(bytes);
      if (buffer.theme === theme) throw Error("No supported codec");
      return buffer;
    };
    const audio = await started("combat");
    const old = context().sources[0];
    audio.setTheme(theme);
    await settle();
    await pulse(0.1);
    expect(audio.getState()).toBe("combat");
    expect(old.stop).toHaveBeenCalled();
    expect(context().sources).toHaveLength(1);
    expect(context().oscillators.some(voice => voice.frequency.value === 58)).toBe(true);
    expect(requestedPaths()).toContain(`/rts-game/assets/audio/${theme}/combat.mp3`);
    expect(signalPath(context().oscillators[0])).toContain(masterBus());
  });
  it.each(["victory", "defeat"] as const)("does not replay a completed %s when the theme changes", async state => {
    const audio = await started(state);
    await pulse(30);
    const count = context().sources.length, requests = requestedPaths().length;
    audio.setTheme("mythic");
    audio.setTheme("mythic");
    audio.setTheme("christmas");
    audio.setTheme("mythic");
    await settle();
    await pulse(45);
    expect(audio.getTheme()).toBe("mythic");
    expect(audio.getState()).toBe(state);
    expect(context().sources).toHaveLength(count);
    expect(requestedPaths()).toHaveLength(requests);
    expect(context().oscillators).toHaveLength(0);
    audio.setState("exploration");
    await settle();
    expect(sourcesFor("exploration", "mythic")).toHaveLength(1);
    audio.setState(state);
    await settle();
    expect(sourcesFor(state, "mythic")).toHaveLength(1);
    expect(sourcesFor(state, "mythic")[0].loop).toBe(false);
  });
  it.each(["victory", "defeat"] as const)("does not start a late theme decode after the playing %s finishes", async state => {
    const late = deferred<Decoded>();
    FakeContext.decoder = async bytes => {
      const buffer = decode(bytes);
      return buffer.theme === "mythic" ? late.promise : buffer;
    };
    const audio = await started(state);
    audio.setTheme("mythic");
    await settle();
    await pulse(30);
    late.resolve({ theme: "mythic", state, duration: durations[state], codec: "ogg" });
    await settle();
    expect(context().sources).toHaveLength(1);
    expect(activeSources()).toHaveLength(0);
    expect(context().oscillators).toHaveLength(0);
  });
  it.each(["victory", "defeat"] as const)("does not replay a finished %s when returning from an app interruption", async state => {
    const audio = await started(state);
    await pulse(30);
    const requests = requestedPaths().length;
    audio.stop();
    audio.setTheme("mythic");
    audio.start(audio.getState());
    audio.unlock();
    await settle();
    await pulse(35);
    expect(context().sources).toHaveLength(1);
    expect(context().oscillators).toHaveLength(0);
    expect(requestedPaths()).toHaveLength(requests);
    audio.setState("exploration");
    await settle();
    expect(sourcesFor("exploration", "mythic")).toHaveLength(1);
    audio.setState(state);
    await settle();
    expect(sourcesFor(state, "mythic")).toHaveLength(1);
  });
  it.each(["victory", "defeat"] as const)("preserves a completed procedural %s through stop, theme selection and restart", async state => {
    fetchMock.mockRejectedValue(new Error("Offline"));
    const audio = await started(state);
    for (let at = 0; at < 15; at += 0.25) await pulse(at, 250);
    const count = context().oscillators.length, requests = requestedPaths().length;
    audio.stop();
    audio.setTheme("mythic");
    audio.start(audio.getState());
    audio.unlock();
    await settle();
    await pulse(30);
    expect(context().oscillators).toHaveLength(count);
    expect(requestedPaths()).toHaveLength(requests);
    audio.setState("exploration");
    await settle();
    await pulse(31);
    expect(context().oscillators.length).toBeGreaterThan(count);
  });
  it.each(["victory", "defeat"] as const)("keeps a finished procedural %s finite across theme changes and late loading", async state => {
    const late = deferred<Decoded>();
    FakeContext.decoder = () => late.promise;
    const audio = director();
    audio.setTheme("mythic");
    audio.start(state);
    audio.unlock();
    await settle();
    for (let at = 0; at < 15; at += 0.25) await pulse(at, 250);
    const count = context().oscillators.length;
    expect(count).toBeGreaterThan(0);
    audio.setTheme("christmas");
    audio.setTheme("mythic");
    late.resolve({ theme: "mythic", state, duration: durations[state], codec: "ogg" });
    await settle();
    await pulse(30);
    expect(context().sources).toHaveLength(0);
    expect(context().oscillators).toHaveLength(count);
    expect(context().oscillators.every(voice => voice.ended)).toBe(true);
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
  it.each((["mythic", "halloween", "space"] as const).flatMap(theme => states.map(state => ({theme, state}))))("ships a separate $theme $state cue and codec fallback with valid loop metadata", ({theme, state}) => {
    const packaged = JSON.parse(
      readFileSync(resolve(`public/assets/audio/${theme}/manifest.json`), "utf8"),
    );
    expect(Object.keys(packaged).sort()).toEqual([...states].sort());
    const entry = packaged[state];
    expect(entry.src).toBe(`assets/audio/${theme}/${state}.ogg`);
    expect(entry.fallback).toBe(`assets/audio/${theme}/${state}.mp3`);
    expect(Number.isFinite(entry.duration)).toBe(true);
    expect(entry.duration).toBeGreaterThan(0);
    expect(Number.isFinite(entry.bpm)).toBe(true);
    expect(entry.bpm).toBeGreaterThan(0);
    expect(entry.volume).toBeGreaterThan(0);
    expect(entry.volume).toBeLessThanOrEqual(1);
    expect(entry.loop).toBe(state !== "victory" && state !== "defeat");
    if (entry.loop) {
      expect(Number.isFinite(entry.loopStart)).toBe(true);
      expect(entry.loopStart).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(entry.loopEnd)).toBe(true);
      expect(entry.loopEnd).toBeGreaterThan(entry.loopStart);
      expect(entry.loopEnd).toBeLessThanOrEqual(entry.duration);
    }
    const ogg = readFileSync(resolve("public", entry.src));
    const mp3 = readFileSync(resolve("public", entry.fallback));
    expect(ogg.length).toBeGreaterThan(1000);
    expect(mp3.length).toBeGreaterThan(1000);
    expect(ogg.subarray(0, 4).toString("ascii")).toBe("OggS");
    expect(mp3.subarray(0, 3).toString("ascii") === "ID3" ||
      (mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0)).toBe(true);
    expect(ogg.equals(readFileSync(resolve(`public/assets/audio/${state}.ogg`)))).toBe(false);
    expect(mp3.equals(readFileSync(resolve(`public/assets/audio/${state}.mp3`)))).toBe(false);
    if (theme === "halloween" || theme === "space") {
      expect(ogg.equals(readFileSync(resolve(`public/assets/audio/mythic/${state}.ogg`)))).toBe(false);
      expect(mp3.equals(readFileSync(resolve(`public/assets/audio/mythic/${state}.mp3`)))).toBe(false);
    }
    if (theme === "space") {
      expect(ogg.equals(readFileSync(resolve(`public/assets/audio/halloween/${state}.ogg`)))).toBe(false);
      expect(mp3.equals(readFileSync(resolve(`public/assets/audio/halloween/${state}.mp3`)))).toBe(false);
    }
  });
});
