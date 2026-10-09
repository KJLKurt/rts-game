import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
 ...base,testMatch:/\/workshop-preview-layout\.spec\.ts$/,
 projects:base.projects!.filter(p=>p.name==='phone-portrait'),
 timeout:120_000,retries:0,maxFailures:0,workers:1,globalTimeout:3*60_000,
 use:{...base.use,trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'},
 webServer:{command:'node .qa-serve-previous.mjs',url:'http://127.0.0.1:4181/rts-game/',reuseExistingServer:false,timeout:30_000},
 outputDir:'test-results-preview-layout-red',
 reporter:[['list'],['json',{outputFile:'preview-layout-red-ledger.json'}],['html',{open:'never',outputFolder:'preview-layout-red-report'}]],
});
