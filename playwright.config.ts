import {defineConfig, devices} from '@playwright/test';

/** Run against the production build: Vite dev deliberately does not register a worker. */
const external = process.env.FRONTIER_TEST_URL;
const subsetQA = !!process.env.CI && process.env.GITHUB_REF_NAME === 'qa-browser-check' && process.env.FRONTIER_FULL_BROWSER_QA !== '1';
export default defineConfig({
  testMatch: subsetQA ? /(?:troop-selection|defeat-guidance|first-candidate-ui|touch-target-discrimination|hud-collisions|interruption|game|pwa)\.spec\.ts$/ : undefined,
  grep: subsetQA ? /(?:troop-selection\.spec\.ts|defeat-guidance\.spec\.ts|first-candidate-ui\.spec\.ts|touch-target-discrimination\.spec\.ts|hud-collisions\.spec\.ts|interruption\.spec\.ts|pwa\.spec\.ts|desktop keyboard movement and space pause work|phone thumbstick works in either orientation and cancels on interruption)/ : undefined,
  testDir: './tests/browser',
  timeout: 35_000,
  expect: {timeout: 8_000},
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: subsetQA ? 0 : process.env.CI ? 1 : 0,
  maxFailures: subsetQA ? 4 : process.env.CI ? 6 : 0,
  // Canvas-heavy games should not spawn one browser per reported host CPU.
  workers: process.env.FRONTIER_TEST_WORKERS ? Math.max(1, Number(process.env.FRONTIER_TEST_WORKERS)) : 2,
  reporter: [['list'], ['html', {open: 'never', outputFolder: 'playwright-report'}], ['json', {outputFile:'playwright-report/subset-focused.json'}]],
  use: {
    baseURL: external || 'http://127.0.0.1:4181/rts-game/',
    trace: subsetQA ? 'off' : 'on-first-retry', screenshot: 'only-on-failure', video: 'off',
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {},
  },
  projects: [
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
