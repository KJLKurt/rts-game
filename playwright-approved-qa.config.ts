import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,retries:0,maxFailures:0,workers:2,timeout:45000,
 reporter:[['list'],['json',{outputFile:process.env.FRONTIER_QA_REPORT || 'evidence/focused-first-report.json'}]],
 use:{...base.use,baseURL:'http://127.0.0.1:50304/rts-game/',launchOptions:{executablePath:'/usr/bin/chromium',chromiumSandbox:true},trace:'retain-on-failure'},
 webServer:undefined,outputDir:process.env.FRONTIER_QA_ARTIFACTS || 'evidence/focused-first-artifacts'});
