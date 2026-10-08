import {defineConfig, devices} from '@playwright/test';

/** Run against the production build: Vite dev deliberately does not register a worker. */
const external = process.env.FRONTIER_TEST_URL;
// Temporary diagnostic scope on the isolated QA branch only. The full gate is
// unchanged below and can be explicitly selected with FRONTIER_FULL_BROWSER_QA=1.
const diagnostic = !!process.env.CI && process.env.GITHUB_REF_NAME === 'qa-browser-check' && process.env.FRONTIER_FULL_BROWSER_QA !== '1';
if (diagnostic) console.log('SCOPED DIAGNOSTIC: two existing identities, one worker, zero retries. This is not the full acceptance gate.');
export default defineConfig({
  testDir: './tests/browser',
  timeout: 35_000,
  expect: {timeout: 8_000},
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: diagnostic ? 0 : process.env.CI ? 1 : 0,
  maxFailures: diagnostic ? 0 : process.env.CI ? 6 : 0,
  // Canvas-heavy games should not spawn one browser per reported host CPU.
  workers: diagnostic ? 1 : process.env.FRONTIER_TEST_WORKERS ? Math.max(1, Number(process.env.FRONTIER_TEST_WORKERS)) : 2,
  reporter: diagnostic ? [['list'], ['html', {open: 'never', outputFolder: 'playwright-report'}], ['json', {outputFile: 'playwright-report/scoped-diagnostic.json'}]] : [['list'], ['html', {open: 'never', outputFolder: 'playwright-report'}]],
  use: {
    baseURL: external || 'http://127.0.0.1:4181/rts-game/',
    trace: diagnostic ? 'off' : 'on-first-retry', screenshot: 'only-on-failure', video: 'off',
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {},
  },
  projects: diagnostic ? [
    {name: 'phone-portrait', use: {...devices['Pixel 7'], viewport: {width: 390, height: 844}}, testMatch: /approved-mobile-ui\.spec\.ts$/, grep: /approved phone sheets keep logical targets, resource values and map space at three widths and enlarged text/},
    {name: 'phone-landscape', use: {...devices['Pixel 7'], viewport: {width: 844, height: 390}}, testMatch: /battle-feedback-lifecycle\.spec\.ts$/, grep: /Ironwatch retry retires prior defeat feedback and preserves fresh paused orders/},
  ] : [
    {name: 'desktop', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 900}}, testIgnore: /pwa\.spec\.ts/},
    {name: 'phone-portrait', use: {...devices['Pixel 7'], viewport: {width: 390, height: 844}}, testIgnore: /pwa\.spec\.ts/},
    {name: 'phone-landscape', use: {...devices['Pixel 7'], viewport: {width: 844, height: 390}}, testIgnore: /pwa\.spec\.ts/},
    {name: 'pwa', use: {...devices['Desktop Chrome']}, testMatch: /pwa\.spec\.ts/},
  ],
  webServer: external ? undefined : {
    command: 'npm run build && node tests/browser/serve-production.mjs',
    url: 'http://127.0.0.1:4181/rts-game/',
    reuseExistingServer: false, timeout: 120_000,
  },
});
