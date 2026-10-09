import type { Locator, Page } from '@playwright/test';
import type { AudioState } from '../../src/platform/audio';
import { action, expect, home, setSlider, test } from './helpers';

type Theme = 'christmas' | 'mythic' | 'halloween' | 'space';
type SourceReceipt = {
  id: number; asset: string; start: number; stop: number | null; ended: boolean; disconnected: boolean;
  loop: boolean; duration: number; route: string[]; gain: number;
  targets: { value: number; at: number; constant: number }[];
};
type AudioBus = 'master' | 'music' | 'effects';
type BusAutomation = { method: 'setTargetAtTime' | 'setValueAtTime' | 'cancelScheduledValues'; at: number; value?: number; constant?: number };
type BusSample = { at: number; master: number; music: number; effects: number };
type Signal = { peak: number; rms: number; samples: number; reads: number; window: number; firstAt: number | null; lastAt: number | null };
type EffectReceipt = {
  frequency: number; route: string[]; start: number; scheduled: BusSample; rendered: BusSample | null;
  signal: Signal; musicSignal: Signal; masterSignal: Signal;
};
type AudioReceipt = {
  context: AudioContextState | null; currentTime: number; master: number; music: number; effects: number;
  busTargets: { master: SourceReceipt['targets']; music: SourceReceipt['targets']; effects: SourceReceipt['targets'] };
  busAutomation: Record<AudioBus, BusAutomation[]>;
  effectsMeter: { fftSize: number; sampleRate: number; route: string } | null;
  maxConnectedSources: number; sources: SourceReceipt[]; decoded: string[]; held: string[];
  effectsVoices: EffectReceipt[];
};
declare global {
  interface Window {
    __QA_THEME_AUDIO__: {
      read(): AudioReceipt; hold(asset: string): void; release(): void; clearEffects(): void;
    };
  }
}

/** Native WebAudio only: observe calls and actual graph connections; never replace contexts or clocks. */
async function observeAudio(page: Page, measureEffects = false) {
  await page.addInitScript(({ measureEffects }) => {
    const gains: GainNode[] = [], decoded: string[] = [], effectsVoices: AudioReceipt['effectsVoices'] = [];
    const links = new WeakMap<AudioNode, AudioNode | AudioParam>();
    const bytes = new WeakMap<ArrayBuffer, string>(), buffers = new WeakMap<AudioBuffer, string>();
    const targets = new WeakMap<AudioParam, SourceReceipt['targets']>();
    const automation = new WeakMap<AudioParam, BusAutomation[]>();
    const meters: Partial<Record<AudioBus, AnalyserNode>> = {};
    const voices: { source: AudioBufferSourceNode; gain?: GainNode; receipt: SourceReceipt }[] = [];
    const held: string[] = [], releases: (() => void)[] = [];
    let context: AudioContext | undefined, effectsMeter: AnalyserNode | undefined, holdAsset = '', maxConnectedSources = 0;
    const arrayBuffer = Response.prototype.arrayBuffer;
    Response.prototype.arrayBuffer = async function () {
      const data = await arrayBuffer.call(this), asset = new URL(this.url, location.href).pathname;
      bytes.set(data, asset);
      if (holdAsset && asset.endsWith(holdAsset)) {
        held.push(asset); await new Promise<void>(resolve => releases.push(resolve));
      }
      return data;
    };
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function (data, success, failure) {
      const asset = bytes.get(data) ?? 'unmapped';
      return decode.call(this, data, buffer => {
        buffers.set(buffer, asset); decoded.push(asset); success?.(buffer);
      }, failure);
    };
    const connect = AudioNode.prototype.connect, disconnect = AudioNode.prototype.disconnect;
    const createGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      context = this;
      const gain = createGain.call(this); gains.push(gain); targets.set(gain.gain, []); automation.set(gain.gain, []);
      if (gains.length <= 3 && measureEffects) {
        // Passive native taps observe each bus independently. Existing audible
        // connections and gains stay intact; no meter output reaches Destination.
        // Use native connect so the route ledger still follows the audible path.
        const bus = (['master', 'music', 'effects'] as const)[gains.length - 1];
        const meter = this.createAnalyser(); meter.fftSize = 2048; meters[bus] = meter;
        if (bus === 'effects') effectsMeter = meter;
        Reflect.apply(connect, gain, [meter]);
      }
      return gain;
    };
    AudioNode.prototype.connect = function (this: AudioNode, ...args: Parameters<typeof connect>) {
      const result = Reflect.apply(connect, this, args);
      links.set(this, args[0]);
      // Count the actual graph at every native connection, including queued
      // starts and retiring sources. A future stop does not free a graph slot.
      maxConnectedSources = Math.max(maxConnectedSources, voices.filter(v => links.has(v.source)).length);
      return result;
    } as typeof connect;
    AudioNode.prototype.disconnect = function (this: AudioNode, ...args: Parameters<typeof disconnect>) {
      const voice = voices.find(v => v.source === this);
      if (voice) voice.receipt.disconnected = true;
      links.delete(this); return Reflect.apply(disconnect, this, args);
    } as typeof disconnect;
    const target = AudioParam.prototype.setTargetAtTime;
    AudioParam.prototype.setTargetAtTime = function (value, at, constant) {
      automation.get(this)?.push({ method: 'setTargetAtTime', value, at, constant });
      targets.get(this)?.push({ value, at, constant }); return target.call(this, value, at, constant);
    };
    const setValue = AudioParam.prototype.setValueAtTime, cancel = AudioParam.prototype.cancelScheduledValues;
    AudioParam.prototype.setValueAtTime = function (value, at) {
      automation.get(this)?.push({ method: 'setValueAtTime', value, at }); return setValue.call(this, value, at);
    };
    AudioParam.prototype.cancelScheduledValues = function (at) {
      automation.get(this)?.push({ method: 'cancelScheduledValues', at }); return cancel.call(this, at);
    };
    // unlock() creates master, music, effects, fallback in that order. Verify
    // every recorded route through their real native graph, not just the order.
    const route = (node: AudioNode) => {
      const result: string[] = [];
      let next = links.get(node);
      for (let depth = 0; next && depth < 6; depth++) {
        result.push(next === gains[0] ? 'master' : next === gains[1] ? 'music' : next === gains[2] ? 'effects' : next === context?.destination ? 'destination' : 'voice-gain');
        next = next instanceof AudioNode ? links.get(next) : undefined;
      }
      return result;
    };
    const createSource = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = createSource.call(this), start = source.start, stop = source.stop;
      const receipt: SourceReceipt = { id: voices.length, asset: '', start: -1, stop: null, ended: false,
        disconnected: false, loop: false, duration: 0, route: [], gain: 0, targets: [] };
      const voice = { source, gain: undefined as GainNode | undefined, receipt }; voices.push(voice);
      source.start = function (...args: Parameters<typeof start>) {
        receipt.asset = buffers.get(source.buffer!) ?? 'unmapped'; receipt.start = args[0] ?? 0;
        receipt.loop = source.loop; receipt.duration = source.buffer?.duration ?? 0; receipt.route = route(source);
        voice.gain = links.get(source) as GainNode; receipt.targets = targets.get(voice.gain.gain) ?? [];
        return Reflect.apply(start, this, args);
      };
      source.stop = function (at = 0) { receipt.stop = at || this.context.currentTime; return stop.call(this, at); };
      source.addEventListener('ended', () => { receipt.ended = true; });
      return source;
    };
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const oscillator = createOscillator.call(this), start = oscillator.start;
      let effect: EffectReceipt | undefined, monitor = 0;
      const sumSquares = { signal: 0, musicSignal: 0, masterSignal: 0 };
      const emptySignal = (): Signal => ({ peak: 0, rms: 0, samples: 0, reads: 0,
        window: effectsMeter ? effectsMeter.fftSize / effectsMeter.context.sampleRate : 0, firstAt: null, lastAt: null });
      const sampleBus = (): BusSample => ({ at: oscillator.context.currentTime,
        master: gains[0].gain.value, music: gains[1].gain.value, effects: gains[2].gain.value });
      const capture = () => {
        // Replace the whole analyser window with this cue's rendered frames;
        // allow a few extra native quanta for the queued start to take effect.
        if (!effect || !effectsMeter || oscillator.context.currentTime < effect.start + effect.signal.window + .01) return;
        for (const [field, bus] of [['signal', 'effects'], ['musicSignal', 'music'], ['masterSignal', 'master']] as const) {
          const meter = meters[bus]!, signal = effect[field], samples = new Float32Array(meter.fftSize);
          meter.getFloatTimeDomainData(samples);
          for (const value of samples) {
            signal.peak = Math.max(signal.peak, Math.abs(value)); sumSquares[field] += value * value;
          }
          signal.samples += samples.length; signal.reads++;
          signal.rms = Math.sqrt(sumSquares[field] / signal.samples);
          signal.firstAt ??= oscillator.context.currentTime;
          signal.lastAt = oscillator.context.currentTime;
        }
      };
      oscillator.start = function (at = 0) {
        const path = route(oscillator);
        if (path.includes('effects')) {
          effect = { frequency: oscillator.frequency.value, route: path, start: at, scheduled: sampleBus(), rendered: null,
            signal: emptySignal(), musicSignal: emptySignal(), masterSignal: emptySignal() };
          effectsVoices.push(effect);
        }
        const result = start.call(this, at);
        if (effect && effectsMeter) monitor = window.setInterval(capture, 10);
        return result;
      };
      oscillator.addEventListener('ended', () => {
        if (!effect) return;
        capture(); window.clearInterval(monitor);
        // AudioParam.value reflects rendering, not a newly queued automation
        // request. Read it after this real application cue has actually ended.
        // https://webaudio.github.io/web-audio-api/#computation-of-value
        effect.rendered = sampleBus();
      });
      return oscillator;
    };
    const busTargets = (index: number) => gains[index] ? [...targets.get(gains[index].gain) ?? []] : [];
    const busAutomation = (index: number) => gains[index] ? [...automation.get(gains[index].gain) ?? []] : [];
    window.__QA_THEME_AUDIO__ = {
      read: () => ({ context: context?.state ?? null, currentTime: context?.currentTime ?? 0, master: gains[0]?.gain.value ?? 0,
        music: gains[1]?.gain.value ?? 0, effects: gains[2]?.gain.value ?? 0, maxConnectedSources,
        busTargets: { master: busTargets(0), music: busTargets(1), effects: busTargets(2) },
        busAutomation: { master: busAutomation(0), music: busAutomation(1), effects: busAutomation(2) },
        effectsMeter: effectsMeter ? { fftSize: effectsMeter.fftSize, sampleRate: effectsMeter.context.sampleRate,
          route: 'Independent Master, Music and Effects -> passive AnalyserNode taps (no outputs); all audible connections preserved' } : null,
        sources: voices.filter(v => v.receipt.start >= 0).map(v => ({ ...v.receipt, gain: v.gain?.gain.value ?? 0,
          targets: [...v.receipt.targets] })), decoded: [...decoded], held: [...held], effectsVoices: structuredClone(effectsVoices) }),
      hold: asset => { holdAsset = asset; },
      release: () => { holdAsset = ''; for (const release of releases.splice(0)) release(); },
      clearEffects: () => { effectsVoices.length = 0; },
    };
  }, { measureEffects });
}
const audio = (page: Page) => page.evaluate(() => window.__QA_THEME_AUDIO__.read());
const asset = (theme: Theme, state: AudioState) => `/assets/audio/${theme === 'christmas' ? '' : `${theme}/`}${state}.`;
const hasAsset = (source: SourceReceipt, theme: Theme, state: AudioState) => source.asset.includes(asset(theme, state));
async function press(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await locator.tap();
  else await locator.click();
}
const settings = (page: Page) => page.getByRole('dialog', { name: 'Settings', exact: true });
async function openSettings(page: Page) {
  if (await page.evaluate(() => window.__FRONTIER__.playing)) await press(page, action(page, 'pause-menu'));
  await press(page, action(page, 'settings')); await expect(settings(page)).toBeVisible();
}
async function closeSettings(page: Page) {
  await press(page, settings(page).getByRole('button', { name: 'Done', exact: true }));
  await expect(settings(page)).toHaveCount(0);
}
async function choose(page: Page, theme: Theme) {
  const select = settings(page).getByLabel('Visual theme', { exact: true });
  await select.scrollIntoViewIfNeeded(); await select.selectOption(theme);
  await expect(select).toBeEnabled(); await expect(select).toHaveValue(theme);
  await expect.poll(() => page.evaluate(() => (window.__FRONTIER__.renderer as typeof window.__FRONTIER__.renderer & { visualTheme: Theme }).visualTheme)).toBe(theme);
}
async function currentSource(page: Page, theme: Theme, state: AudioState) {
  await expect.poll(async () => {
    const last = (await audio(page)).sources.at(-1);
    return !!last && hasAsset(last, theme, state) && !last.ended && !last.disconnected;
  }).toBe(true);
  const source = (await audio(page)).sources.at(-1)!;
  expect(source.route).toEqual(['voice-gain', 'music', 'master', 'destination']);
  expect(source.loop).toBe(!['victory', 'defeat'].includes(state));
  return source;
}
async function paused(page: Page, value: boolean) {
  if (await page.evaluate(() => window.__FRONTIER__.state.paused) !== value) await press(page, action(page, 'pause'));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(value);
}
/** Stay in this document so native source history survives; all buttons use native touch on phones. */
async function launchHere(page: Page) {
  await press(page, action(page, 'skirmish'));
  await page.getByLabel('Map seed', { exact: true }).fill('QA-MYTHIC-AUDIO-2026');
  await page.locator('select[name="mapSize"]').selectOption('small');
  await page.locator('select[name="difficulty"]').selectOption('easy');
  await press(page, action(page, 'launch')); await expect(page.locator('.hud')).toBeVisible();
  const briefing = page.getByRole('dialog', { name: 'Your first frontier', exact: true });
  if (await briefing.count()) await press(page, briefing.getByRole('button', { name: 'Start battle', exact: true }));
  // The landscape field guide can exist in the DOM while hidden by CSS.
  if (await action(page, 'dismiss-tips').isVisible()) await press(page, action(page, 'dismiss-tips'));
  await paused(page, true);
}
async function selectionCue(page: Page) {
  await page.evaluate(() => window.__QA_THEME_AUDIO__.clearEffects());
  await press(page, action(page, 'select-commander'));
  await expect.poll(async () => {
    const effects = (await audio(page)).effectsVoices;
    return effects.length === 1 && effects[0].rendered !== null;
  }).toBe(true);
  const effects = (await audio(page)).effectsVoices;
  expect(effects).toHaveLength(1); expect(effects[0].frequency).toBe(420);
  expect(effects[0].route).toEqual(['voice-gain', 'effects', 'master', 'destination']);
  expect(effects[0].rendered!.at).toBeGreaterThan(effects[0].start);
  for (const signal of [effects[0].signal, effects[0].musicSignal, effects[0].masterSignal]) {
    expect(signal.reads).toBeGreaterThan(0);
    expect(signal.firstAt!).toBeGreaterThanOrEqual(effects[0].start + signal.window);
    expect(signal.firstAt!, 'The native meter captures during the real 220 ms selection envelope').toBeLessThan(effects[0].start + .22);
  }
  return { ...effects[0], rendered: effects[0].rendered! };
}
async function settleBus(page: Page, bus: AudioBus) {
  const snapshot = await audio(page), target = snapshot.busAutomation[bus].filter(call => call.value !== undefined).at(-1)!;
  expect(target).toBeDefined(); expect(snapshot.effectsMeter).not.toBeNull();
  // Let the requested gain settle in real AudioContext time. A dormant meter
  // may retain its old ring; capture() separately waits a full active cue window.
  const settledAt = target.at + 12 * (target.constant ?? 0) + snapshot.effectsMeter!.fftSize / snapshot.effectsMeter!.sampleRate;
  await expect.poll(async () => (await audio(page)).currentTime).toBeGreaterThan(settledAt);
  return target;
}
function exactZero(snapshot: AudioReceipt, bus: AudioBus) {
  const calls = snapshot.busAutomation[bus], zero = calls.at(-1)!;
  expect(zero, `${bus}: an explicit zero replaces prior smoothing`).toMatchObject({ method: 'setValueAtTime', value: 0 });
  expect(calls.at(-2), `${bus}: prior automation is cancelled at the zero boundary`).toMatchObject({ method: 'cancelScheduledValues', at: zero.at });
  return calls.slice(-2);
}
async function receipt(name: string, data: unknown) {
  await test.info().attach(name, { contentType: 'application/json', body: JSON.stringify(data, null, 2) });
}

// Exercise the same native signal/lifecycle contract for each authored alternate bank.
for (const focusTheme of ['mythic', 'halloween', 'space'] as const) {
test(`${focusTheme}: theme music follows native settings, independent buses and a paused offline save without changing progression`, async ({ page, context }) => {
  // Includes three independent bus controls, recovery and a full offline reload.
  test.setTimeout(90_000);
  test.info().annotations.push({ type: 'controlled-interruption', description: 'Browser blur/focus notifications are injected; volume/theme controls, selection cues and recovery use real UI. Three passive native analysers keep the buses separate.' });
  await observeAudio(page, true); await home(page);
  const profile = await page.evaluate(() => window.__FRONTIER__.profile);
  expect((await audio(page)).context).toBeNull();
  await openSettings(page); await currentSource(page, 'christmas', 'menu');
  await choose(page, focusTheme); await currentSource(page, focusTheme, 'menu');
  await test.info().attach(`${focusTheme}-audio-settings-${test.info().project.name}`, {
    contentType: 'image/png', body: await page.screenshot({ scale: 'css' }),
  });
  await setSlider(page, '#master-slider', .4); await setSlider(page, '#music-slider', 0); await setSlider(page, '#sfx-slider', .2);
  await expect.poll(async () => Math.round((await audio(page)).master * 100)).toBe(40);
  await expect.poll(async () => (await audio(page)).music).toBeLessThan(.001);
  const musicZeroSchedule = exactZero(await audio(page), 'music');
  await closeSettings(page); await launchHere(page); await currentSource(page, focusTheme, 'exploration');
  const before = await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state));
  await settleBus(page, 'effects');
  const musicOff = await selectionCue(page);
  await receipt('music-zero-future-source-native-cue', { musicZeroSchedule, musicOff });
  expect(musicOff.rendered.master).toBeCloseTo(.4, 2); expect(musicOff.rendered.effects).toBeCloseTo(.2, 2);
  expect(musicOff.rendered.music).toBe(0);
  expect(musicOff.musicSignal.peak, 'Music stays exactly silent when the exploration source starts later').toBe(0);
  expect(musicOff.signal.peak).toBeGreaterThan(.001);
  await openSettings(page); await setSlider(page, '#music-slider', .3); await setSlider(page, '#sfx-slider', 0);
  await expect.poll(async () => Math.round((await audio(page)).music * 100)).toBe(30);
  const zeroRequest = await audio(page);
  const effectsZeroRequest = { currentTime: zeroRequest.currentTime, reportedGainBeforeCue: zeroRequest.effects,
    target: zeroRequest.busAutomation.effects.at(-1), automation: zeroRequest.busAutomation.effects.slice(-2),
    slider: await page.locator('#sfx-slider').inputValue(),
    persisted: await page.evaluate(() => JSON.parse(localStorage.getItem('frontier-command:rts-game:v1:preferences')!).sfx) };
  await receipt('effects-zero-request-before-native-cue', effectsZeroRequest);
  exactZero(zeroRequest, 'effects');
  expect(effectsZeroRequest.slider).toBe('0'); expect(effectsZeroRequest.persisted).toBe(0);
  await settleBus(page, 'effects'); await closeSettings(page);
  const effectsOff = await selectionCue(page);
  await receipt('effects-zero-rendered-native-cue', effectsOff);
  expect(effectsOff.rendered.effects).toBeLessThan(.001);
  expect(effectsOff.signal.peak, 'The real selection cue is silent after the Effects bus').toBeLessThan(.000001);
  expect(effectsOff.rendered.effects).toBe(0); expect(effectsOff.signal.peak).toBe(0);
  expect(effectsOff.musicSignal.peak, 'Restoring Music produces native samples independently of Effects').toBeGreaterThan(.0001);
  const musicOn = await audio(page);
  expect(musicOn.busAutomation.music.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: .3, constant: .15 });
  expect(musicOn.sources.at(-1)!.gain * musicOn.music * musicOn.master).toBeGreaterThan(.001);
  await openSettings(page); await setSlider(page, '#sfx-slider', .2);
  expect(await settleBus(page, 'effects')).toMatchObject({ method: 'setTargetAtTime', value: .2, constant: .05 });
  await closeSettings(page); const effectsRestored = await selectionCue(page);
  await receipt('effects-restored-rendered-native-cue', effectsRestored);
  expect(effectsRestored.rendered.effects).toBeCloseTo(.2, 2);
  expect(effectsRestored.signal.peak, 'Restoring Effects restores the real selection cue').toBeGreaterThan(.001);
  await openSettings(page); await setSlider(page, '#master-slider', 0);
  const masterZeroSchedule = exactZero(await audio(page), 'master');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('frontier-command:rts-game:v1:preferences')!).master)).toBe(0);
  await settleBus(page, 'master'); await closeSettings(page);
  const masterOff = await selectionCue(page);
  await receipt('master-zero-rendered-native-cue', { masterZeroSchedule, masterOff });
  expect(masterOff.rendered.master).toBe(0); expect(masterOff.masterSignal.peak).toBe(0);
  expect(masterOff.signal.peak).toBeGreaterThan(.001);
  expect(masterOff.musicSignal.peak).toBeGreaterThan(.0001);
  const sourcesBeforeInterruption = (await audio(page)).sources.length;
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('dialog', { name: 'Battle suspended', exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await press(page, action(page, 'resume-app'));
  await expect(page.getByRole('dialog', { name: 'Battle suspended', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await audio(page)).sources.length).toBeGreaterThan(sourcesBeforeInterruption);
  await currentSource(page, focusTheme, 'exploration');
  const resumedZeroSchedule = exactZero(await audio(page), 'master');
  const resumedAtZero = await selectionCue(page);
  await receipt('master-zero-interruption-native-cue', { resumedZeroSchedule, resumedAtZero });
  expect(resumedAtZero.rendered.master).toBe(0); expect(resumedAtZero.masterSignal.peak).toBe(0);
  expect(resumedAtZero.signal.peak).toBeGreaterThan(.001);
  expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state))).toBe(before);
  await openSettings(page); await setSlider(page, '#master-slider', .4);
  expect(await settleBus(page, 'master')).toMatchObject({ method: 'setTargetAtTime', value: .4, constant: .05 });
  await closeSettings(page); const masterRestored = await selectionCue(page);
  await receipt('master-restored-rendered-native-cue', masterRestored);
  expect(masterRestored.rendered.master).toBeCloseTo(.4, 2);
  expect(masterRestored.masterSignal.peak).toBeGreaterThan(.0001);
  await openSettings(page);
  await press(page, settings(page).getByLabel('Mute all audio', { exact: true }));
  const muteSchedule = exactZero(await audio(page), 'master');
  await expect.poll(async () => (await audio(page)).master).toBeLessThan(.001);
  for (const theme of ['christmas', 'mythic', 'halloween', 'space', focusTheme] as const) {
    await choose(page, theme); await currentSource(page, theme, 'exploration');
    expect((await audio(page)).master).toBeLessThan(.001);
    expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state))).toBe(before);
  }
  await closeSettings(page); const muted = await selectionCue(page);
  await receipt('mute-zero-future-theme-native-cue', { muteSchedule, muted });
  expect(muted.rendered.master).toBeLessThan(.001);
  expect(muted.rendered.master).toBe(0); expect(muted.masterSignal.peak).toBe(0);
  expect(muted.signal.peak).toBeGreaterThan(.001);
  expect(await page.evaluate(() => window.__FRONTIER__.profile)).toEqual(profile);
  const online = await audio(page); expect(online.maxConnectedSources).toBeLessThanOrEqual(2);
  await press(page, action(page, 'pause-menu')); await press(page, action(page, 'save-leave'));
  await expect(action(page, 'continue')).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cached = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('frontier-command-rts-game-'));
    return (await Promise.all(names.map(async name => (await (await caches.open(name)).keys()).map(r => new URL(r.url).pathname)))).flat();
  });
  for (const theme of ['christmas', 'mythic', 'halloween', 'space', focusTheme] as const) {
    expect(cached).toContain(`/rts-game/assets/audio/${theme === 'christmas' ? '' : `${theme}/`}manifest.json`);
    for (const state of ['menu', 'exploration', 'tension', 'combat', 'victory', 'defeat']) {
      for (const codec of ['ogg', 'mp3']) expect(cached).toContain(`/rts-game/assets/audio/${theme === 'christmas' ? '' : `${theme}/`}${state}.${codec}`);
    }
  }
  await context.setOffline(true); await page.reload(); await expect(action(page, 'continue')).toBeVisible();
  await openSettings(page); await expect(settings(page).getByLabel('Visual theme', { exact: true })).toHaveValue(focusTheme);
  await expect(settings(page).getByLabel('Mute all audio', { exact: true })).toBeChecked();
  await expect(page.locator('#master-slider')).toHaveValue('0.4'); await expect(page.locator('#music-slider')).toHaveValue('0.3');
  await expect(page.locator('#sfx-slider')).toHaveValue('0.2'); await currentSource(page, focusTheme, 'menu');
  await choose(page, 'christmas'); await currentSource(page, 'christmas', 'menu');
  await choose(page, focusTheme); await currentSource(page, focusTheme, 'menu'); await closeSettings(page);
  await press(page, action(page, 'continue')); await expect(page.locator('.hud')).toBeVisible();
  await currentSource(page, focusTheme, 'exploration');
  const offlineMuted = await selectionCue(page);
  await receipt('offline-mute-zero-native-cue', offlineMuted);
  expect(offlineMuted.rendered.master).toBe(0); expect(offlineMuted.masterSignal.peak).toBe(0);
  expect(offlineMuted.signal.peak).toBeGreaterThan(.001);
  await openSettings(page); await press(page, settings(page).getByLabel('Mute all audio', { exact: true }));
  expect(await settleBus(page, 'master')).toMatchObject({ method: 'setTargetAtTime', value: .4, constant: .05 });
  await closeSettings(page); const offlineRestored = await selectionCue(page);
  await receipt('offline-unmute-restored-native-cue', offlineRestored);
  expect(offlineRestored.rendered.master).toBeCloseTo(.4, 2);
  expect(offlineRestored.masterSignal.peak).toBeGreaterThan(.0001);
  expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state))).toBe(before);
  expect(await page.evaluate(() => window.__FRONTIER__.profile)).toEqual(profile);
  const offline = await audio(page); expect(offline.maxConnectedSources).toBeLessThanOrEqual(2);
  await receipt('theme-controls-paused-save-offline', { provenance: 'Real UI input, native WebAudio graph and offline reload. No subjective listening claim.',
    profileUnchanged: true, pausedStateUnchanged: true, cachedAudioFiles: cached.filter(path => path.includes('/assets/audio/')).length,
    musicOff, effectsZeroRequest, effectsOff, effectsRestored, masterOff, resumedAtZero, masterRestored,
    muted, offlineMuted, offlineRestored, online, offline });
});

test(`${focusTheme}: controlled local state and delayed-load fixtures reject stale theme music and retire native outcome sources`, async ({ page, baseURL }) => {
  test.skip(!['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL!).hostname), 'Result fixtures are confined to fresh local test profiles.');
  test.setTimeout(90_000);
  test.info().annotations.push({ type: 'controlled-fixture', description: 'Hold an actual asset read; inject recent hit events, terminal winner values and browser blur/focus events. Theme selection, navigation and the recovery gesture use real UI. This is routing/lifecycle acceptance, not natural victories or subjective listening.' });
  await observeAudio(page); await home(page); await openSettings(page); await currentSource(page, 'christmas', 'menu');
  await page.evaluate(theme => window.__QA_THEME_AUDIO__.hold(`/assets/audio/${theme}/menu.ogg`), focusTheme);
  await choose(page, focusTheme);
  await expect.poll(async () => (await audio(page)).held.length).toBe(1);
  await choose(page, 'christmas'); await currentSource(page, 'christmas', 'menu');
  await choose(page, focusTheme); await closeSettings(page); await launchHere(page);
  await currentSource(page, focusTheme, 'exploration');
  await page.evaluate(() => window.__QA_THEME_AUDIO__.release());
  await expect.poll(async () => (await audio(page)).decoded.some(path => path.endsWith(`/assets/audio/${focusTheme}/menu.ogg`))).toBe(true);
  // Decoding has completed; allow its Promise continuation and native scheduling to settle.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const afterLateDecode = await audio(page);
  expect(afterLateDecode.sources.filter(source => hasAsset(source, focusTheme, 'menu'))).toEqual([]);
  await currentSource(page, focusTheme, 'exploration');
  // Pausing does not pause the AudioContext's combat hold. Exercise rapid bank
  // swaps in stable exploration, before introducing any controlled pressure.
  await openSettings(page);
  for (const theme of ['christmas', 'mythic', 'halloween', 'space', 'christmas', focusTheme] as const) {
    await choose(page, theme); await currentSource(page, theme, 'exploration');
  }
  await closeSettings(page);
  await paused(page, false);
  for (const [state, count] of [['tension', 1], ['combat', 5]] as const) {
    await page.evaluate(count => {
      const s = window.__FRONTIER__.state;
      for (let i = 0; i < count; i++) s.events.push({ id: s.nextEventId++, type: 'hit', team: 0, targetTeam: 1, x: 1, y: 1, time: s.time });
    }, count);
    await currentSource(page, focusTheme, state);
  }
  await paused(page, true);
  const outcomes: { state: string; source: SourceReceipt; zeroSchedule: BusAutomation[]; restoreSchedule: BusAutomation;
    menuSource: number; restoredMaster: number }[] = [];
  for (const [state, winner] of [['victory', 0], ['defeat', 1]] as const) {
    if (state === 'defeat') await launchHere(page);
    await page.evaluate(({ state, winner }) => {
      window.__FRONTIER__.state.winner = winner;
      window.__FRONTIER__.state.victoryReason = `Controlled ${state} audio lifecycle fixture`;
    }, { state, winner });
    await expect(page.locator('.result-dialog')).toBeVisible();
    await expect(page.locator('#result-save-status')).toHaveText('Result saved on this device.');
    const source = await currentSource(page, focusTheme, state), count = (await audio(page)).sources.length;
    await expect.poll(async () => {
      const result = (await audio(page)).sources.find(row => row.id === source.id)!;
      return result.ended && result.disconnected;
    }, { timeout: Math.ceil(source.duration * 1000) + 5_000 }).toBe(true);
    // Cross several real 120 ms scheduling ticks after the native ended event.
    await page.waitForTimeout(400);
    expect((await audio(page)).sources).toHaveLength(count);
    const ended = (await audio(page)).sources.find(row => row.id === source.id)!;
    expect(ended.stop, 'The outcome finishes naturally rather than being cut short').toBeNull();
    // Inject only the browser interruption notification. The score's stop path
    // remains real, and a trusted native gesture must not replay the completed coda.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const stopped = await audio(page), zeroSchedule = exactZero(stopped, 'master');
    expect(stopped.sources.filter(voice => !voice.ended && !voice.disconnected)).toEqual([]);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await press(page, page.locator('.result-dialog .result-reason'));
    const restoreSchedule = (await audio(page)).busAutomation.master.at(-1)!;
    expect(restoreSchedule).toMatchObject({ method: 'setTargetAtTime', value: .85, constant: .05 });
    await page.waitForTimeout(400);
    expect((await audio(page)).sources, 'Trusted recovery preserves the completed outcome').toHaveLength(count);
    // This branch is deliberately dormant. Verify restored gain only once real
    // navigation starts a new menu source, never by activating a dummy source.
    await press(page, action(page, 'result-home'));
    const menu = await currentSource(page, focusTheme, 'menu');
    await expect.poll(async () => (await audio(page)).master).toBeGreaterThan(.8);
    outcomes.push({ state, source: ended, zeroSchedule, restoreSchedule, menuSource: menu.id, restoredMaster: (await audio(page)).master });
  }
  const final = await audio(page);
  expect(final.maxConnectedSources).toBeLessThanOrEqual(2);
  expect(new Set(final.sources.filter(source => source.asset.includes(`/assets/audio/${focusTheme}/`)).map(source => source.asset.split('/').pop()!.split('.')[0])))
    .toEqual(new Set(['menu', 'exploration', 'tension', 'combat', 'victory', 'defeat']));
  expect(final.sources.every(source => source.asset !== 'unmapped')).toBe(true);
  for (const source of final.sources) expect(source.route).toEqual(['voice-gain', 'music', 'master', 'destination']);
  await receipt('controlled-theme-state-lifecycle', { provenance: 'Local isolated event/result fixtures, one held native asset read, injected browser blur/focus followed by a trusted recovery gesture, and native source/gain/stop observations. No natural-win or subjective listening claim.',
    afterLateDecode, outcomes, final });
});

}
