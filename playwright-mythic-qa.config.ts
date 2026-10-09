import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,
  retries: 0, maxFailures: 0, globalTimeout: 600_000,
  testMatch: /(?:theme-audio|audio|visual-themes|interruption)\.spec\.ts/,
  grep: /^(?:.*)(?:theme music follows native settings|controlled local state and delayed-load fixtures|all six offline music states in both theme banks|native theme selection updates portraits|artwork switching preserves paused battle|both complete sets and directional art work|a missing required directional image|interruption silences audio until the explicit recovery gesture)/,
  reporter: [['list'], ['json', {outputFile:'test-results/identity-ledger.json'}], ['html',{open:'never',outputFolder:'playwright-report'}]],
  use: {...base.use, trace:'off',video:'off',screenshot:'only-on-failure'},
});
