import {defineConfig} from '@playwright/test';
import base from './playwright.config';

/** Continuation of the three C2 identities after preserving 20 passes and one declared skip. */
export default defineConfig({
  ...base,
  testMatch:/\/(planning-consistency|tutorial|queued-construction|approved-mobile-ui)\.spec\.ts$/,
  grep:/C2 compact next countdown/,
  projects:base.projects!.filter(p=>p.name!=='pwa'),
  timeout:90_000,retries:0,maxFailures:0,workers:2,globalTimeout:12*60_000,
  use:{...base.use,trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'},
  webServer:{command:'node tests/browser/serve-production.mjs',url:'http://127.0.0.1:4181/rts-game/',reuseExistingServer:false,timeout:30_000},
  outputDir:'test-results-planning',
  reporter:[['list'],['json',{outputFile:'planning-identity-ledger.json'}],['html',{open:'never',outputFolder:'planning-report'}]],
});
