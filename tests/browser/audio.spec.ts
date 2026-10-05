import { test, expect } from "@playwright/test";

test("all six offline music states decode from both replaceable codecs", async ({
  page,
}) => {
  await page.goto("./");
  const decoded = await page.evaluate(async () => {
    const entries = await (await fetch("assets/audio/manifest.json")).json();
    const context = new OfflineAudioContext(2, 1, 44100);
    const results = [];
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
        results.push({
          state,
          source,
          duration: buffer.duration,
          expected: entry.duration,
          channels: buffer.numberOfChannels,
          loop: entry.loop,
          loopEnd: entry.loopEnd,
        });
      }
    }
    return results;
  });
  expect(new Set(decoded.map((row) => row.state))).toEqual(
    new Set(["menu", "exploration", "tension", "combat", "victory", "defeat"]),
  );
  expect(decoded).toHaveLength(12);
  for (const row of decoded) {
    expect(row.channels, row.source).toBe(2);
    // Allow browser-specific trimming of MP3 encoder delay.
    expect(Math.abs(row.duration - row.expected), row.source).toBeLessThan(
      0.08,
    );
    if (row.loop) expect(row.loopEnd, row.source).toBe(row.expected);
  }
});
