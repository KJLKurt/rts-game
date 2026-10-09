import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: /halloween-theme\.spec\.ts/,
  grep: /Space native crowd selection and Move/,
  retries: 0, maxFailures: 0, workers: 2, globalTimeout: 6 * 60_000,
  projects: base.projects!.filter(project => project.name !== 'pwa'),
  use: {...base.use, trace: 'off', screenshot: 'only-on-failure', video: 'off'},
  outputDir: 'test-results-space',
  reporter: [['list'], ['json', {outputFile: 'space-identity-ledger.json'}],
    ['html', {open: 'never', outputFolder: 'space-report'}]],
});

