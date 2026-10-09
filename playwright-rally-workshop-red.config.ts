import {defineConfig} from '@playwright/test';
import base from './playwright.config';
/** Two deliberate positive oracles against exact previous-live production. */
export default defineConfig({
 ...base,testMatch:/\/(mass-rally-boundaries|workshop-duration-boundaries)\.spec\.ts$/,
 grep:/C3 native mass rally 60 pending|C5 native workshop 91 minutes:/,
 projects:base.projects!.filter(p=>p.name==='desktop'),
 timeout:120_000,retries:0,maxFailures:0,workers:1,globalTimeout:5*60_000,
 use:{...base.use,trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'},
 webServer:{command:'node .qa-serve-previous.mjs',url:'http://127.0.0.1:4181/rts-game/',reuseExistingServer:false,timeout:30_000},
 outputDir:'test-results-rally-workshop-red',
 reporter:[['list'],['json',{outputFile:'rally-workshop-red-ledger.json'}],['html',{open:'never',outputFolder:'rally-workshop-red-report'}]],
});
