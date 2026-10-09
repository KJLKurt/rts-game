import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser', testMatch:/editor-fling-fixture\.spec\.ts/,
  fullyParallel:false, workers:1, retries:0, maxFailures:0,
  timeout:90_000, globalTimeout:4*60_000, expect:{timeout:8_000},
  forbidOnly:!!process.env.CI,
  reporter:[['list'],['json',{outputFile:'fling-fixture-results.json'}]],
  use:{trace:'off',screenshot:'off',video:'off'},
  projects:[
    {name:'phone-portrait',use:{...devices['Pixel 7'],viewport:{width:390,height:844}}},
    {name:'phone-landscape',use:{...devices['Pixel 7'],viewport:{width:844,height:390}}},
  ],
});
