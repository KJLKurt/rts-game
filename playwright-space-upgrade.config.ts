import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base, testMatch: /release-update\.spec\.ts/,
  retries: 0, maxFailures: 0, workers: 1, timeout: 90_000, globalTimeout: 4 * 60_000,
  projects: base.projects!.filter(project => project.name === 'desktop'),
  use: {...base.use, trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'off'},
  outputDir: 'test-results-space-upgrade',
  reporter: [['list'], ['json', {outputFile: 'space-upgrade-identity-ledger.json'}],
    ['html', {open: 'never', outputFolder: 'space-upgrade-report'}]],
});

