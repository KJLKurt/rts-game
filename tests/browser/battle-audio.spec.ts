import type { Locator, Page } from '@playwright/test';
import type { GameEvent } from '../../src/sim/types';
import { action, expect, home, launch, setSlider, test } from './helpers';

type Automation = { method: 'setValueAtTime' | 'exponentialRampToValueAtTime'; value: number; at: number };
type Voice = { frequency: number; wave: OscillatorType; start: number; stop: number; envelope: Automation[]; sweep: Automation[]; route: string[]; master: number; effects: number };
type Receipt = { state: AudioContextState | null; master: number; effects: number; resumes: { trusted: boolean; hidden: boolean }[]; voices: Voice[] };
declare global {
  interface Window {
    __QA_BATTLE_AUDIO__: { read(): Receipt; clear(): void; suspend(): Promise<void> };
  }
}

/** Observe native nodes and calls; no fake AudioContext, clock, or application audio implementation. */
async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const gains: GainNode[] = [], voices: Voice[] = [];
    const connections = new WeakMap<AudioNode, AudioNode | AudioParam>();
    const automation = new WeakMap<AudioParam, Automation[]>();
    const resumes: Receipt['resumes'] = [];
    let context: AudioContext | undefined;
    const createGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      context = this;
      const node = createGain.call(this);
      gains.push(node); automation.set(node.gain, []);
      return node;
    };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: Parameters<typeof connect>) {
      connections.set(this, args[0]);
      return Reflect.apply(connect, this, args);
    } as typeof connect;
    for (const method of ['setValueAtTime', 'exponentialRampToValueAtTime'] as const) {
      const original = AudioParam.prototype[method];
      AudioParam.prototype[method] = function (value: number, at: number) {
        automation.get(this)?.push({ method, value, at });
        return original.call(this, value, at);
      };
    }
    const resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function () {
      resumes.push({ trusted: window.event?.isTrusted === true, hidden: document.hidden });
      return resume.call(this);
    };
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const oscillator = createOscillator.call(this);
      automation.set(oscillator.frequency, []);
      const start = oscillator.start, stop = oscillator.stop;
      let voice: Voice | undefined;
      oscillator.start = function (at = 0) {
        const envelope = connections.get(oscillator) as GainNode;
        // The first four app gains are master, music, effects and fallback.
        // Follow the real connection graph, retaining only effects voices.
        if (connections.get(envelope) === gains[2]) {
          voice = { frequency: oscillator.frequency.value, wave: oscillator.type, start: at, stop: 0,
            envelope: automation.get(envelope.gain)!, sweep: automation.get(oscillator.frequency)!,
            route: ['voice', 'effects', ...(connections.get(gains[2]) === gains[0] ? ['master'] : []),
              ...(connections.get(gains[0]) === context!.destination ? ['destination'] : [])],
            master: gains[0].gain.value, effects: gains[2].gain.value };
          voices.push(voice);
        }
        return start.call(this, at);
      };
      oscillator.stop = function (at = 0) {
        if (voice) voice.stop = at;
        return stop.call(this, at);
      };
      return oscillator;
    };
    window.__QA_BATTLE_AUDIO__ = {
      read: () => ({ state: context?.state ?? null, master: gains[0]?.gain.value ?? 0, effects: gains[2]?.gain.value ?? 0,
        resumes: [...resumes], voices: structuredClone(voices) }),
      clear: () => { voices.length = 0; },
      suspend: async () => { await context?.suspend(); },
    };
  });
}
const audio = (page: Page) => page.evaluate(() => window.__QA_BATTLE_AUDIO__.read());
const clearAudio = (page: Page) => page.evaluate(() => window.__QA_BATTLE_AUDIO__.clear());
async function press(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await locator.tap();
  else await locator.click();
}
async function closeSettings(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await press(page, dialog.getByRole('button', { name: 'Done', exact: true }));
  await expect(dialog).toHaveCount(0);
}
async function paused(page: Page, value: boolean) {
  if (await page.evaluate(() => window.__FRONTIER__.state.paused) !== value) await press(page, action(page, 'pause'));
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(value);
}
async function frames(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
type EventFixture = Pick<GameEvent, 'type' | 'team'> & Partial<GameEvent>;
async function emit(page: Page, events: EventFixture[]) {
  await page.evaluate(events => {
    const s = window.__FRONTIER__.state;
    for (const event of events) s.events.push({ x: 1, y: 1, ...event, id: s.nextEventId++, time: s.time });
  }, events);
  await frames(page);
}
function routed(voices: Voice[]) {
  for (const voice of voices) expect(voice.route).toEqual(['voice', 'effects', 'master', 'destination']);
}
async function receipt(name: string, data: unknown) {
  await test.info().attach(name, { contentType: 'application/json', body: JSON.stringify(data, null, 2) });
}

test('native trusted unlock, volume controls and interruption gate the real effects bus', async ({ page }) => {
  await observeAudio(page); await home(page);
  expect((await audio(page)).state).toBeNull();
  await page.locator('#app').dispatchEvent('pointerdown');
  expect((await audio(page)).resumes).toEqual([]);
  await press(page, action(page, 'settings'));
  await page.getByLabel('Visual theme', { exact: true }).selectOption('christmas');
  await expect(page.getByLabel('Visual theme', { exact: true })).toBeEnabled();
  await expect.poll(async () => (await audio(page)).state).toBe('running');
  expect((await audio(page)).resumes.every(call => call.trusted && !call.hidden)).toBe(true);
  await setSlider(page, '#master-slider', .4); await setSlider(page, '#sfx-slider', .2);
  await expect.poll(async () => Math.round((await audio(page)).master * 100)).toBe(40);
  await expect.poll(async () => Math.round((await audio(page)).effects * 100)).toBe(20);
  await press(page, page.locator('#mute-audio'));
  await expect.poll(async () => (await audio(page)).master).toBeLessThan(.001);
  await press(page, page.locator('#mute-audio'));
  await expect.poll(async () => Math.round((await audio(page)).master * 100)).toBe(40);
  if (test.info().project.name === 'desktop') await test.info().attach('christmas-audio-settings', {
    body: await page.screenshot({ scale: 'css' }), contentType: 'image/png',
  });
  await closeSettings(page);
  await launch(page, { difficulty: 'easy' }); await paused(page, true);
  await clearAudio(page); await emit(page, [{ type: 'attack', team: 0 }]);
  const audible = await audio(page);
  expect(audible.voices.map(voice => voice.frequency)).toEqual([145, 1260, 1817, 2943]); routed(audible.voices);
  for (const voice of audible.voices) { expect(voice.master).toBeCloseTo(.4, 2); expect(voice.effects).toBeCloseTo(.2, 2); }
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('dialog', { name: 'Battle suspended', exact: true })).toBeVisible();
  await expect.poll(async () => (await audio(page)).master).toBeLessThan(.001);
  const interrupted = await audio(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus'));
  });
  await page.keyboard.press('q');
  expect((await audio(page)).resumes).toHaveLength(interrupted.resumes.length);
  expect((await audio(page)).master).toBeLessThan(.001);
  await press(page, action(page, 'resume-app'));
  await expect(page.getByRole('dialog', { name: 'Battle suspended', exact: true })).toHaveCount(0);
  await expect.poll(async () => Math.round((await audio(page)).master * 100)).toBe(40);
  expect((await audio(page)).resumes.length).toBeGreaterThan(interrupted.resumes.length);
  // Use a genuinely suspended native context to verify play() schedules no cue.
  await page.evaluate(() => window.__QA_BATTLE_AUDIO__.suspend()); await clearAudio(page);
  expect((await audio(page)).state).toBe('suspended');
  await emit(page, [{ type: 'projectile', subtype: 'archer', team: 0 }]);
  expect((await audio(page)).voices).toEqual([]);
  await press(page, action(page, 'select-commander'));
  await expect.poll(async () => (await audio(page)).state).toBe('running');
  await receipt('trusted-input-volume-interruption', { audible, interrupted, recovered: await audio(page),
    visibilityNote: 'visibilitychange/focus are injected browser events; WebAudio remains native.' });
});

test('the first construction completion after native save and reload plays once', async ({ page }) => {
  await observeAudio(page); await home(page);
  await press(page, action(page, 'settings'));
  await page.getByLabel('Visual theme', { exact: true }).selectOption('mythic');
  await expect(page.getByLabel('Visual theme', { exact: true })).toBeEnabled();
  await closeSettings(page);
  await launch(page, { difficulty: 'easy' }); await paused(page, true);
  await press(page, action(page, 'panel-build'));
  await press(page, page.getByRole('button', { name: 'Build House', exact: true }));
  // Reuse the app's legal initial preview, as in first-candidate-ui.spec.ts.
  // Canvas picking is separate acceptance; this gate exercises paid placement.
  const confirmBuild = page.locator('#placement-controls').getByRole('button', { name: 'Confirm build', exact: true });
  await expect(confirmBuild).toBeEnabled();
  await press(page, confirmBuild);
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.pendingCommands)).toEqual([
    expect.objectContaining({ type: 'build', building: 'house', team: 0 }),
  ]);
  await paused(page, false);
  await expect.poll(() => page.evaluate(() => window.__FRONTIER__.state.entities.some(e => e.team === 0 && e.type === 'house' && e.buildProgress < 1))).toBe(true);
  await paused(page, true);
  // Controlled near-completion timing only. Placement/payment/save/reload and
  // the final simulation tick/event/audio path remain the actual application.
  const checkpoint = await page.evaluate(() => {
    const s = window.__FRONTIER__.state, building = s.entities.find(e => e.team === 0 && e.type === 'house' && e.buildProgress < 1)!;
    building.buildProgress = .999; building.hp = building.maxHp * .999;
    return { id: building.id, nextEventId: s.nextEventId, time: s.time, tick: s.tick };
  });
  await press(page, action(page, 'pause-menu')); await press(page, action(page, 'save-leave'));
  await expect(action(page, 'continue')).toBeVisible(); await page.reload();
  await press(page, action(page, 'continue')); await expect(page.locator('.hud')).toBeVisible();
  expect(await page.evaluate(id => window.__FRONTIER__.state.entities.find(e => e.id === id)!.buildProgress, checkpoint.id)).toBe(.999);
  expect(await page.evaluate(() => ({ nextEventId: window.__FRONTIER__.state.nextEventId, paused: window.__FRONTIER__.state.paused })))
    .toEqual({ nextEventId: checkpoint.nextEventId, paused: true });
  await clearAudio(page); await paused(page, false);
  await expect.poll(async () => (await audio(page)).voices.filter(v => [523, 659, 784].includes(v.frequency)).map(v => v.frequency)).toEqual([523, 659, 784]);
  await paused(page, true);
  const completion = await page.evaluate(id => window.__FRONTIER__.state.events.find(e => e.entityId === id && e.type === 'build' && e.subtype === 'complete'), checkpoint.id);
  expect(completion?.id, 'Do not skip nextEventId, the first future event after restore').toBe(checkpoint.nextEventId);
  const cues = (await audio(page)).voices.filter(v => [523, 659, 784].includes(v.frequency)); routed(cues);
  await page.waitForTimeout(350);
  expect((await audio(page)).voices.filter(v => [523, 659, 784].includes(v.frequency))).toEqual(cues);
  await receipt('restored-construction-completion', { controlledTimingFixture: true, checkpoint, completion, cues });
});

test('controlled battle releases produce distinct single cues, hide enemy activity and render an objective WAV receipt', async ({ page }) => {
  await observeAudio(page); await launch(page, { difficulty: 'easy' }); await paused(page, true);
  await clearAudio(page);
  await emit(page, [{ type: 'attack', team: 0 }, { type: 'hit', team: 0, targetTeam: 1 }]);
  const melee = (await audio(page)).voices;
  expect(melee.map(v => v.frequency)).toEqual([145, 1260, 1817, 2943]); routed(melee);
  await page.waitForTimeout(350);
  expect((await audio(page)).voices).toEqual(melee);
  await clearAudio(page);
  await emit(page, [{ type: 'projectile', subtype: 'archer', team: 0 }, { type: 'hit', team: 0, targetTeam: 1 }]);
  const arrow = (await audio(page)).voices;
  expect(arrow.map(v => v.sweep.map(event => event.value))).toEqual([[960, 220], [2400, 650]]); routed(arrow);
  expect(arrow.map(v => v.wave)).toEqual(['triangle', 'sine']);
  await page.waitForTimeout(350); expect((await audio(page)).voices).toEqual(arrow);
  await clearAudio(page);
  await page.evaluate(() => { window.__FRONTIER__.state.fog.visible[0][0] = 0; });
  await emit(page, [{ type: 'attack', team: 1, x: 0, y: 0 }, { type: 'projectile', subtype: 'archer', team: 1, x: 0, y: 0 }, { type: 'build', subtype: 'complete', team: 1 }]);
  expect((await audio(page)).voices).toEqual([]);
  await page.evaluate(() => { window.__FRONTIER__.state.fog.visible[0][0] = 1; });
  await emit(page, [{ type: 'projectile', subtype: 'ranger', team: 1, x: 0, y: 0 }]);
  expect((await audio(page)).voices.map(v => v.sweep.map(event => event.value))).toEqual([[960, 220], [2400, 650]]);
  await clearAudio(page); await emit(page, [{ type: 'build', subtype: 'complete', team: 0 }]);
  const complete = (await audio(page)).voices;
  expect(complete.map(v => v.frequency)).toEqual([523, 659, 784]); routed(complete);
  const rendered = await page.evaluate(async groups => {
    const rate = 24000, segment = .65;
    const offline = new OfflineAudioContext(1, Math.ceil(rate * segment * groups.length), rate);
    for (const [index, group] of groups.entries()) {
      const origin = Math.min(...group.voices.map(v => v.start)), offset = segment * index + .025;
      for (const voice of group.voices) {
        const osc = offline.createOscillator(), gain = offline.createGain(), bus = offline.createGain();
        osc.type = voice.wave; osc.frequency.value = voice.frequency;
        for (const event of voice.sweep) osc.frequency[event.method](event.value, event.at - origin + offset);
        for (const event of voice.envelope) gain.gain[event.method](event.value, event.at - origin + offset);
        bus.gain.value = voice.effects * voice.master;
        osc.connect(gain); gain.connect(bus); bus.connect(offline.destination);
        osc.start(voice.start - origin + offset); osc.stop(voice.stop - origin + offset);
      }
    }
    const samples = (await offline.startRendering()).getChannelData(0);
    const metrics = groups.map((group, i) => {
      const data = samples.slice(Math.round(i * segment * rate), Math.round((i + 1) * segment * rate));
      let peak = 0, sum = 0, nonzero = 0;
      for (const value of data) { peak = Math.max(peak, Math.abs(value)); sum += value * value; if (Math.abs(value) > .00001) nonzero++; }
      return { name: group.name, peak, rms: Math.sqrt(sum / data.length), nonzero };
    });
    const distances = [[0, 1], [1, 2], [0, 2]].map(([a, b]) => {
      let sum = 0; const length = Math.round(segment * rate);
      for (let i = 0; i < length; i++) sum += (samples[a * length + i] - samples[b * length + i]) ** 2;
      return { pair: [groups[a].name, groups[b].name], rmsDifference: Math.sqrt(sum / length) };
    });
    return { rate, metrics, distances, pcm: Array.from(samples, value => Math.round(Math.max(-1, Math.min(1, value)) * 32767)) };
  }, [{ name: 'completion', voices: complete }, { name: 'melee', voices: melee }, { name: 'arrow', voices: arrow }]);
  for (const metric of rendered.metrics) { expect(metric.peak).toBeGreaterThan(.005); expect(metric.peak).toBeLessThan(1); expect(metric.nonzero).toBeGreaterThan(100); }
  for (const distance of rendered.distances) expect(distance.rmsDifference).toBeGreaterThan(.002);
  const wav = Buffer.alloc(44 + rendered.pcm.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rendered.rate, 24); wav.writeUInt32LE(rendered.rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  rendered.pcm.forEach((value, index) => wav.writeInt16LE(value, 44 + index * 2));
  if (test.info().project.name === 'desktop') await test.info().attach('recorded-schedules-completion-melee-arrow.wav', { body: wav, contentType: 'audio/wav' });
  await receipt('recorded-schedules-objective-audio', { provenance: 'Controlled event fixtures through the real app router; native oscillator schedules re-rendered offline. No subjective listening claim.',
    order: ['completion', 'melee', 'arrow'], secondsPerCue: .65, complete, melee, arrow, metrics: rendered.metrics, distances: rendered.distances });
});
