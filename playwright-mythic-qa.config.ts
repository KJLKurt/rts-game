import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,
  retries: 0, maxFailures: 0, globalTimeout: 600_000,
  testMatch: /theme-audio\.spec\.ts/,
  grep: /theme music follows native settings, independent buses and a paused offline save without changing progression/,
  reporter: [['list'], ['json', {outputFile:'test-results/identity-ledger.json'}], ['html',{open:'never',outputFolder:'playwright-report'}]],
  use: {...base.use, trace:'off',video:'off',screenshot:'only-on-failure'},
});
