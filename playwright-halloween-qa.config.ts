import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: /(?:halloween-theme|theme-audio|audio)\.spec\.ts/,
  grep: /Halloween|halloween:|all six offline music states/,
  retries: 0, maxFailures: 0, workers: 2, globalTimeout: 15 * 60_000,
  projects: base.projects!.filter(project => project.name !== 'pwa'),
  use: {...base.use, trace: 'off', screenshot: 'only-on-failure', video: 'off'},
  outputDir: 'test-results-halloween',
  reporter: [['list'], ['json', {outputFile: 'halloween-identity-ledger.json'}],
    ['html', {open: 'never', outputFolder: 'halloween-report'}]],
});
