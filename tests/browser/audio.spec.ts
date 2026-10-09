import { test, expect } from "@playwright/test";

test("all six offline music states in all three theme banks decode from both replaceable codecs", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("./");
  const decoded = await page.evaluate(async () => {
    const context = new OfflineAudioContext(2, 1, 44100);
    const results = [];
    for (const bank of ["christmas", "mythic", "halloween"]) {
      const manifest = bank === "christmas" ? "assets/audio/manifest.json" : `assets/audio/${bank}/manifest.json`;
      const response = await fetch(manifest);
      if (!response.ok) throw Error(`Missing music manifest: ${manifest}`);
      const entries = await response.json();
      for (const [state, value] of Object.entries(entries)) {
        const entry = value as {
          src: string;
          fallback: string;
          duration: number;
          loop: boolean;
          loopEnd?: number;
        };
        for (const source of [entry.src, entry.fallback]) {
          const response = await fetch(source);
          if (!response.ok) throw Error(`Missing music asset: ${source}`);
          const buffer = await context.decodeAudioData(
            await response.arrayBuffer(),
          );
          const samples = buffer.getChannelData(0);
          let peak = 0, sum = 0, count = 0;
          for (let i = 0; i < samples.length; i += Math.max(1, Math.floor(samples.length / 8192))) {
            peak = Math.max(peak, Math.abs(samples[i])); sum += samples[i] ** 2; count++;
          }
          results.push({
            bank,
            state,
            source,
            duration: buffer.duration,
            expected: entry.duration,
            channels: buffer.numberOfChannels,
            loop: entry.loop,
            loopEnd: entry.loopEnd,
            peak,
            rms: Math.sqrt(sum / count),
          });
        }
      }
    }
    return results;
  });
  for (const bank of ["christmas", "mythic", "halloween"]) {
    const rows = decoded.filter(row => row.bank === bank);
    expect(new Set(rows.map((row) => row.state)), bank).toEqual(
      new Set(["menu", "exploration", "tension", "combat", "victory", "defeat"]),
    );
    expect(rows, bank).toHaveLength(12);
    for (const state of new Set(rows.map(row => row.state))) {
      expect(rows.filter(row => row.state === state).map(row => row.source.split('.').pop()).sort()).toEqual(['mp3', 'ogg']);
    }
  }
  expect(decoded).toHaveLength(36);
  for (const row of decoded) {
    expect(row.channels, row.source).toBe(2);
    expect(row.loop, row.source).toBe(!['victory', 'defeat'].includes(row.state));
    expect(row.peak, `Non-silent sampled signal: ${row.source}`).toBeGreaterThan(.001);
    expect(row.rms, row.source).toBeGreaterThan(.0001);
    // Allow browser-specific trimming of MP3 encoder delay.
    expect(Math.abs(row.duration - row.expected), row.source).toBeLessThan(
      0.08,
    );
    if (row.loop) expect(row.loopEnd, row.source).toBe(row.expected);
  }
  await test.info().attach('all-theme-codecs-objective-receipt', {
    contentType: 'application/json', body: JSON.stringify({
      provenance: 'Native OfflineAudioContext decode and sampled signal measurements; no subjective listening claim.', decoded,
    }, null, 2),
  });
});
