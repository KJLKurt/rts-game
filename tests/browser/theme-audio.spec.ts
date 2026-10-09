import type { Locator, Page } from '@playwright/test';
import type { AudioState } from '../../src/platform/audio';
import { action, expect, home, setSlider, test } from './helpers';

type Theme = 'christmas' | 'mythic';
type SourceReceipt = {
  id: number; asset: string; start: number; stop: number | null; ended: boolean; disconnected: boolean;
  loop: boolean; duration: number; route: string[]; gain: number;
  targets: { value: number; at: number; constant: number }[];
};
type AudioReceipt = {
  context: AudioContextState | null; master: number; music: number; effects: number;
  maxConnectedSources: number; sources: SourceReceipt[]; decoded: string[]; held: string[];
  effectsVoices: { frequency: number; route: string[]; master: number; effects: number }[];
};
declare global {
  interface Window {
    __QA_THEME_AUDIO__: {
      read(): AudioReceipt; hold(asset: string): void; release(): void; clearEffects(): void;
    };
  }
}

/** Native WebAudio only: observe calls and actual graph connections; never replace contexts or clocks. */
async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const gains: GainNode[] = [], decoded: string[] = [], effectsVoices: AudioReceipt['effectsVoices'] = [];
    const links = new WeakMap<AudioNode, AudioNode | AudioParam>();
    const bytes = new WeakMap<ArrayBuffer, string>(), buffers = new WeakMap<AudioBuffer, string>();
    const targets = new WeakMap<AudioParam, SourceReceipt['targets']>();
    const voices: { source: AudioBufferSourceNode; gain?: GainNode; receipt: SourceReceipt }[] = [];
    const held: string[] = [], releases: (() => void)[] = [];
    let context: AudioContext | undefined, holdAsset = '', maxConnectedSources = 0;
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
    const createGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      context = this;
      const gain = createGain.call(this); gains.push(gain); targets.set(gain.gain, []); return gain;
    };
    const connect = AudioNode.prototype.connect, disconnect = AudioNode.prototype.disconnect;
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
      targets.get(this)?.push({ value, at, constant }); return target.call(this, value, at, constant);
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
      oscillator.start = function (at = 0) {
        const path = route(oscillator);
        if (path.includes('effects')) effectsVoices.push({ frequency: oscillator.frequency.value, route: path,
          master: gains[0].gain.value, effects: gains[2].gain.value });
        return start.call(this, at);
      };
      return oscillator;
    };
    window.__QA_THEME_AUDIO__ = {
      read: () => ({ context: context?.state ?? null, master: gains[0]?.gain.value ?? 0,
        music: gains[1]?.gain.value ?? 0, effects: gains[2]?.gain.value ?? 0, maxConnectedSources,
        sources: voices.filter(v => v.receipt.start >= 0).map(v => ({ ...v.receipt, gain: v.gain?.gain.value ?? 0,
          targets: [...v.receipt.targets] })), decoded: [...decoded], held: [...held], effectsVoices: structuredClone(effectsVoices) }),
      hold: asset => { holdAsset = asset; },
      release: () => { holdAsset = ''; for (const release of releases.splice(0)) release(); },
      clearEffects: () => { effectsVoices.length = 0; },
    };
  });
}
const audio = (page: Page) => page.evaluate(() => window.__QA_THEME_AUDIO__.read());
const asset = (theme: Theme, state: AudioState) => `/assets/audio/${theme === 'mythic' ? 'mythic/' : ''}${state}.`;
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
  const effects = (await audio(page)).effectsVoices;
  expect(effects).toHaveLength(1); expect(effects[0].frequency).toBe(420);
  expect(effects[0].route).toEqual(['voice-gain', 'effects', 'master', 'destination']);
  return effects[0];
}
async function receipt(name: string, data: unknown) {
  await test.info().attach(name, { contentType: 'application/json', body: JSON.stringify(data, null, 2) });
}

test('theme music follows native settings, independent buses and a paused offline save without changing progression', async ({ page, context }) => {
  test.setTimeout(60_000);
  await observeAudio(page); await home(page);
  const profile = await page.evaluate(() => window.__FRONTIER__.profile);
  expect((await audio(page)).context).toBeNull();
  await openSettings(page); await currentSource(page, 'christmas', 'menu');
  await choose(page, 'mythic'); await currentSource(page, 'mythic', 'menu');
  await test.info().attach(`mythic-audio-settings-${test.info().project.name}`, {
    contentType: 'image/png', body: await page.screenshot({ scale: 'css' }),
  });
  await setSlider(page, '#master-slider', .4); await setSlider(page, '#music-slider', 0); await setSlider(page, '#sfx-slider', .2);
  await expect.poll(async () => Math.round((await audio(page)).master * 100)).toBe(40);
  await expect.poll(async () => (await audio(page)).music).toBeLessThan(.001);
  await closeSettings(page); await launchHere(page); await currentSource(page, 'mythic', 'exploration');
  const before = await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state));
  const musicOff = await selectionCue(page); expect(musicOff.master).toBeCloseTo(.4, 2); expect(musicOff.effects).toBeCloseTo(.2, 2);
  await openSettings(page); await setSlider(page, '#music-slider', .3); await setSlider(page, '#sfx-slider', 0);
  await expect.poll(async () => Math.round((await audio(page)).music * 100)).toBe(30);
  await expect.poll(async () => (await audio(page)).effects).toBeLessThan(.001);
  await closeSettings(page); const effectsOff = await selectionCue(page); expect(effectsOff.effects).toBeLessThan(.001);
  const musicOn = await audio(page);
  expect(musicOn.sources.at(-1)!.gain * musicOn.music * musicOn.master).toBeGreaterThan(.001);
  await openSettings(page); await setSlider(page, '#sfx-slider', .2);
  await press(page, settings(page).getByLabel('Mute all audio', { exact: true }));
  await expect.poll(async () => (await audio(page)).master).toBeLessThan(.001);
  for (const theme of ['christmas', 'mythic'] as const) {
    await choose(page, theme); await currentSource(page, theme, 'exploration');
    expect((await audio(page)).master).toBeLessThan(.001);
    expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state))).toBe(before);
  }
  await closeSettings(page); const muted = await selectionCue(page); expect(muted.master).toBeLessThan(.001);
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
  for (const theme of ['christmas', 'mythic'] as const) {
    expect(cached).toContain(`/rts-game/assets/audio/${theme === 'mythic' ? 'mythic/' : ''}manifest.json`);
    for (const state of ['menu', 'exploration', 'tension', 'combat', 'victory', 'defeat']) {
      for (const codec of ['ogg', 'mp3']) expect(cached).toContain(`/rts-game/assets/audio/${theme === 'mythic' ? 'mythic/' : ''}${state}.${codec}`);
    }
  }
  await context.setOffline(true); await page.reload(); await expect(action(page, 'continue')).toBeVisible();
  await openSettings(page); await expect(settings(page).getByLabel('Visual theme', { exact: true })).toHaveValue('mythic');
  await expect(settings(page).getByLabel('Mute all audio', { exact: true })).toBeChecked();
  await expect(page.locator('#master-slider')).toHaveValue('0.4'); await expect(page.locator('#music-slider')).toHaveValue('0.3');
  await expect(page.locator('#sfx-slider')).toHaveValue('0.2'); await currentSource(page, 'mythic', 'menu');
  await press(page, settings(page).getByLabel('Mute all audio', { exact: true }));
  await expect.poll(async () => Math.round((await audio(page)).master * 100)).toBe(40);
  await choose(page, 'christmas'); await currentSource(page, 'christmas', 'menu');
  await choose(page, 'mythic'); await currentSource(page, 'mythic', 'menu'); await closeSettings(page);
  await press(page, action(page, 'continue')); await expect(page.locator('.hud')).toBeVisible();
  await currentSource(page, 'mythic', 'exploration');
  expect(await page.evaluate(() => JSON.stringify(window.__FRONTIER__.state))).toBe(before);
  expect(await page.evaluate(() => window.__FRONTIER__.profile)).toEqual(profile);
  const offline = await audio(page); expect(offline.maxConnectedSources).toBeLessThanOrEqual(2);
  await receipt('theme-controls-paused-save-offline', { provenance: 'Real UI input, native WebAudio graph and offline reload. No subjective listening claim.',
    profileUnchanged: true, pausedStateUnchanged: true, cachedAudioFiles: cached.filter(path => path.includes('/assets/audio/')).length,
    musicOff, effectsOff, muted, online, offline });
});

test('controlled local state and delayed-load fixtures reject stale theme music and retire native outcome sources', async ({ page, baseURL }) => {
  test.skip(!['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL!).hostname), 'Result fixtures are confined to fresh local test profiles.');
  test.setTimeout(90_000);
  test.info().annotations.push({ type: 'controlled-fixture', description: 'Hold an actual asset read; inject recent hit events, terminal winner values and browser blur/focus events. Theme selection, navigation and the recovery gesture use real UI. This is routing/lifecycle acceptance, not natural victories or subjective listening.' });
  await observeAudio(page); await home(page); await openSettings(page); await currentSource(page, 'christmas', 'menu');
  await page.evaluate(() => window.__QA_THEME_AUDIO__.hold('/assets/audio/mythic/menu.ogg'));
  await choose(page, 'mythic');
  await expect.poll(async () => (await audio(page)).held.length).toBe(1);
  await choose(page, 'christmas'); await currentSource(page, 'christmas', 'menu');
  await choose(page, 'mythic'); await closeSettings(page); await launchHere(page);
  await currentSource(page, 'mythic', 'exploration');
  await page.evaluate(() => window.__QA_THEME_AUDIO__.release());
  await expect.poll(async () => (await audio(page)).decoded.some(path => path.endsWith('/assets/audio/mythic/menu.ogg'))).toBe(true);
  // Decoding has completed; allow its Promise continuation and native scheduling to settle.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const afterLateDecode = await audio(page);
  expect(afterLateDecode.sources.filter(source => hasAsset(source, 'mythic', 'menu'))).toEqual([]);
  await currentSource(page, 'mythic', 'exploration');
  // Pausing does not pause the AudioContext's combat hold. Exercise rapid bank
  // swaps in stable exploration, before introducing any controlled pressure.
  await openSettings(page);
  for (const theme of ['christmas', 'mythic', 'christmas', 'mythic'] as const) {
    await choose(page, theme); await currentSource(page, theme, 'exploration');
  }
  await closeSettings(page);
  await paused(page, false);
  for (const [state, count] of [['tension', 1], ['combat', 5]] as const) {
    await page.evaluate(count => {
      const s = window.__FRONTIER__.state;
      for (let i = 0; i < count; i++) s.events.push({ id: s.nextEventId++, type: 'hit', team: 0, targetTeam: 1, x: 1, y: 1, time: s.time });
    }, count);
    await currentSource(page, 'mythic', state);
  }
  await paused(page, true);
  const outcomes: { state: string; source: SourceReceipt }[] = [];
  for (const [state, winner] of [['victory', 0], ['defeat', 1]] as const) {
    if (state === 'defeat') { await press(page, action(page, 'result-home')); await currentSource(page, 'mythic', 'menu'); await launchHere(page); }
    await page.evaluate(({ state, winner }) => {
      window.__FRONTIER__.state.winner = winner;
      window.__FRONTIER__.state.victoryReason = `Controlled ${state} audio lifecycle fixture`;
    }, { state, winner });
    await expect(page.locator('.result-dialog')).toBeVisible();
    await expect(page.locator('#result-save-status')).toHaveText('Result saved on this device.');
    const source = await currentSource(page, 'mythic', state), count = (await audio(page)).sources.length;
    await expect.poll(async () => {
      const result = (await audio(page)).sources.find(row => row.id === source.id)!;
      return result.ended && result.disconnected;
    }, { timeout: Math.ceil(source.duration * 1000) + 5_000 }).toBe(true);
    // Cross several real 120 ms scheduling ticks after the native ended event.
    await page.waitForTimeout(400);
    expect((await audio(page)).sources).toHaveLength(count);
    const ended = (await audio(page)).sources.find(row => row.id === source.id)!;
    expect(ended.stop, 'The outcome finishes naturally rather than being cut short').toBeNull();
    outcomes.push({ state, source: ended });
    // Inject only the browser interruption notification. The score's stop path
    // remains real, and a trusted native gesture must not replay the completed coda.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(async () => (await audio(page)).master).toBeLessThan(.001);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await press(page, page.locator('.result-dialog .result-reason'));
    await expect.poll(async () => (await audio(page)).master).toBeGreaterThan(.8);
    await page.waitForTimeout(400);
    expect((await audio(page)).sources, 'Trusted recovery preserves the completed outcome').toHaveLength(count);
  }
  const final = await audio(page);
  expect(final.maxConnectedSources).toBeLessThanOrEqual(2);
  expect(new Set(final.sources.filter(source => source.asset.includes('/mythic/')).map(source => source.asset.split('/').pop()!.split('.')[0])))
    .toEqual(new Set(['menu', 'exploration', 'tension', 'combat', 'victory', 'defeat']));
  expect(final.sources.every(source => source.asset !== 'unmapped')).toBe(true);
  for (const source of final.sources) expect(source.route).toEqual(['voice-gain', 'music', 'master', 'destination']);
  await receipt('controlled-theme-state-lifecycle', { provenance: 'Local isolated event/result fixtures, one held native asset read, injected browser blur/focus followed by a trusted recovery gesture, and native source/gain/stop observations. No natural-win or subjective listening claim.',
    afterLateDecode, outcomes, final });
});
