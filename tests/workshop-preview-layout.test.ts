import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const shell = main.slice(main.indexOf('function renderGameShell()'), main.indexOf('function cardArt('));

describe('workshop preview return layout structure (native geometry is tested separately)', () => {
  it('puts Return in the measured HUD rather than an absolute battlefield overlay', () => {
    expect(shell).toMatch(/querySelector\("\.hud-clock"\)\?\.insertAdjacentHTML\(/);
    const rules = [...css.matchAll(/\.workshop-test-return\s*\{([^}]+)\}/g)].map(match => match[1]);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).not.toMatch(/position:\s*(absolute|fixed)|(?:^|;)\s*(?:top|right):/);
  });

  it('remeasures preview HUD growth and disconnects its observer with the shell', () => {
    expect(shell).toMatch(/workshopTest\.active && hud \? observeControlDeck\(hud, measurePlayfield\)/);
    expect(shell).toMatch(/stopDeckObservation = \(\) => \{ stopDeck\(\); stopHud\(\); \}/);
  });

  it('retains the existing Return action, label and minimum touch target', () => {
    expect(shell).toContain('button("Return to workshop", "return-to-editor", "", "back")');
    expect(css).toMatch(/\.workshop-test-return button\s*\{[^}]*min-height:\s*44px;/);
  });
});
