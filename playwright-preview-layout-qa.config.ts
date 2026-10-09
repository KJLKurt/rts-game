import {defineConfig} from '@playwright/test';
import base from './playwright.config';
const desktop=base.projects!.find(p=>p.name==='desktop')!;
export default defineConfig({
 ...base,testMatch:/\/(workshop-preview-layout|hud)\.spec\.ts$/,
 grep:/native workshop preview keeps Return clear|income stays per game-second and four-digit stock HUD/,
 projects:[...base.projects!.filter(p=>p.name!=='pwa'),{...desktop,name:'short-desktop',use:{...desktop.use,viewport:{width:1184,height:501}},testMatch:/\/workshop-preview-layout\.spec\.ts$/}],
 timeout:120_000,retries:0,maxFailures:0,workers:2,globalTimeout:10*60_000,
 use:{...base.use,trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'},
 webServer:{command:'node tests/browser/serve-production.mjs',url:'http://127.0.0.1:4181/rts-game/',reuseExistingServer:false,timeout:30_000},
 outputDir:'test-results-preview-layout',
 reporter:[['list'],['json',{outputFile:'preview-layout-identity-ledger.json'}],['html',{open:'never',outputFolder:'preview-layout-report'}]],
});
