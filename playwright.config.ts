import {defineConfig, devices} from '@playwright/test';

/** Run against the production build: Vite dev deliberately does not register a worker. */
const external = process.env.FRONTIER_TEST_URL;
export default defineConfig({
  testDir: './tests/browser',
  testMatch: /research-guidance\.spec\.ts/,
  globalTimeout: 8 * 60_000,
  timeout: 35_000,
  expect: {timeout: 8_000},
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  maxFailures: 0,
  // Canvas-heavy games should not spawn one browser per reported host CPU.
  workers: 1,
  reporter: [['list'], ['json', {outputFile: 'research-guidance-results.json'}]],
  use: {
    baseURL: external || 'http://127.0.0.1:4181/rts-game/',
    trace: 'on-first-retry', screenshot: 'only-on-failure', video: 'off',
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {},
  },
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 900}}, testIgnore: /(?:pwa|approved-mobile-ui|editor-exact-input-diagnostic)\.spec\.ts/},
    {name: 'phone-portrait', use: {...devices['Pixel 7'], viewport: {width: 390, height: 844}}, testIgnore: /pwa\.spec\.ts/},
    {name: 'phone-landscape', use: {...devices['Pixel 7'], viewport: {width: 844, height: 390}}, testIgnore: /pwa\.spec\.ts/},
  ],
  webServer: external ? undefined : {
    command: 'npm run build && node tests/browser/serve-production.mjs',
    url: 'http://127.0.0.1:4181/rts-game/',
    reuseExistingServer: false, timeout: 120_000,
  },
});
