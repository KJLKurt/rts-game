import {defineConfig, devices} from '@playwright/test';

/** Run against the production build: Vite dev deliberately does not register a worker. */
const external = process.env.FRONTIER_TEST_URL;
const focused = !!process.env.CI && process.env.GITHUB_REF_NAME === 'qa-browser-check' && process.env.FRONTIER_FULL_BROWSER_QA !== '1';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 35_000,
  expect: {timeout: 8_000},
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: focused ? 0 : process.env.CI ? 1 : 0,
  maxFailures: process.env.CI ? 6 : 0,
  // Canvas-heavy games should not spawn one browser per reported host CPU.
  workers: process.env.FRONTIER_TEST_WORKERS ? Math.max(1, Number(process.env.FRONTIER_TEST_WORKERS)) : 2,
  reporter: [['list'], ['html', {open: 'never', outputFolder: 'playwright-report'}]],
  use: {
    baseURL: external || 'http://127.0.0.1:4181/rts-game/',
    trace: focused ? 'off' : 'on-first-retry', screenshot: 'only-on-failure', video: 'off',
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {},
  },
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 900}}, testIgnore: /pwa\.spec\.ts/},
    {name: 'phone-portrait', use: {...devices['Pixel 7'], viewport: {width: 390, height: 844}}, testIgnore: /pwa\.spec\.ts/},
    {name: 'phone-landscape', use: {...devices['Pixel 7'], viewport: {width: 844, height: 390}}, testIgnore: /pwa\.spec\.ts/},
    {name: 'pwa', use: {...devices['Desktop Chrome']}, testMatch: /pwa\.spec\.ts/},
  ].filter(project => !focused || project.name === 'phone-landscape').map(project => focused ? {...project,testMatch:/engineer-breach\.spec\.ts$/,grep:/native Attack targeting directs Breach to a farther structure instead of the nearest one/} : project),
  webServer: external ? undefined : {
    command: 'npm run build && node tests/browser/serve-production.mjs',
    url: 'http://127.0.0.1:4181/rts-game/',
    reuseExistingServer: false, timeout: 120_000,
  },
});
