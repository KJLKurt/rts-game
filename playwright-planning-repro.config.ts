import {defineConfig} from '@playwright/test';
import base from './playwright.config';

/** Bounded red reproductions on exact current production. No retries or early cutoff. */
export default defineConfig({
  ...base,
  testMatch: /\/planning-consistency\.spec\.ts$/,
  projects: base.projects!.filter(project=>project.name==='desktop'),
  timeout: 120_000,
  retries: 0,
  maxFailures: 0,
  workers: 1,
  globalTimeout: 8*60_000,
  use: {...base.use,trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'},
  webServer: {command:'node tests/browser/serve-production.mjs',url:'http://127.0.0.1:4181/rts-game/',reuseExistingServer:false,timeout:30_000},
  outputDir:'test-results-planning-repro',
  reporter:[['list'],['json',{outputFile:'planning-repro-identity-ledger.json'}],['html',{open:'never',outputFolder:'planning-repro-report'}]],
});
