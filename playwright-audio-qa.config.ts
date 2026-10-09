import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig(base, {
  testMatch: /(?:battle-audio|audio|interruption)\.spec\.ts/,
  grep: /native trusted unlock|first construction completion|controlled battle releases|all six offline music states|interruption silences audio/,
  projects: base.projects!.filter(project => project.name !== 'pwa'),
  retries: 0, maxFailures: 0, workers: 2, timeout: 45_000, globalTimeout: 600_000,
  reporter: [['list'], ['json', { outputFile: 'test-results/audio-gate-results.json' }], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
});
