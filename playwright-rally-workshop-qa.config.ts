import {defineConfig} from '@playwright/test';
import base from './playwright.config';
/** Eight new boundaries and three affected existing regression identities. */
export default defineConfig({
 ...base,testMatch:/\/(mass-rally-boundaries|workshop-duration-boundaries|release-usability|workshop-complete)\.spec\.ts$/,
 grep:/C3 native mass rally|C5 native workshop|rally wording identifies current producers|workshop dimensions, named copies|invalid workshop settings are atomic/,
 projects:base.projects!.filter(p=>p.name!=='pwa'),
 timeout:120_000,retries:0,maxFailures:0,workers:2,globalTimeout:15*60_000,
 use:{...base.use,trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'},
 webServer:{command:'node tests/browser/serve-production.mjs',url:'http://127.0.0.1:4181/rts-game/',reuseExistingServer:false,timeout:30_000},
 outputDir:'test-results-rally-workshop',
 reporter:[['list'],['json',{outputFile:'rally-workshop-identity-ledger.json'}],['html',{open:'never',outputFolder:'rally-workshop-report'}]],
});
