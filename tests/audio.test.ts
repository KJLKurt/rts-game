import { describe, it, expect, vi, afterEach } from "vitest";
import { AudioDirector } from "../src/platform/audio";
class FakeGain {
  gain = {
    value: 1,
    setTargetAtTime(value: number) {
      this.value = value;
    },
  };
  connect() {}
}
class FakeContext {
  static last: FakeContext;
  currentTime = 0;
  state = "running";
  destination = {};
  gains: FakeGain[] = [];
  constructor() {
    FakeContext.last = this;
  }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  resume() {
    return Promise.resolve();
  }
}
afterEach(() => vi.unstubAllGlobals());
describe("audio volume routing", () => {
  it("applies saved master gain before unlocking audio", () => {
    vi.stubGlobal("AudioContext", FakeContext);
    const audio = new AudioDirector();
    audio.setMaster(0.4);
    audio.unlock();
    expect(FakeContext.last.gains[0].gain.value).toBe(0.4);
  });
  it("mute overrides every routed sound and restores the chosen master level", () => {
    vi.stubGlobal("AudioContext", FakeContext);
    const audio = new AudioDirector();
    audio.unlock();
    audio.setMaster(0.7, true);
    expect(FakeContext.last.gains[0].gain.value).toBe(0);
    audio.setMaster(0.7, false);
    expect(FakeContext.last.gains[0].gain.value).toBe(0.7);
  });
  it("clamps damaged master values without throwing", () => {
    vi.stubGlobal("AudioContext", FakeContext);
    const audio = new AudioDirector();
    audio.unlock();
    audio.setMaster(NaN);
    expect(FakeContext.last.gains[0].gain.value).toBe(0.85);
    audio.setMaster(99);
    expect(FakeContext.last.gains[0].gain.value).toBe(1);
  });
});
